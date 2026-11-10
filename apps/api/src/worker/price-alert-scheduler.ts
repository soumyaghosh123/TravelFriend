import { Inject, Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import type { Clock } from '@tripsaver/providers';
import { Queue, Worker } from 'bullmq';
import { Redis, type RedisOptions } from 'ioredis';
import { CLOCK } from '../tokens.js';
import { PriceAlertChecker } from './price-alert-checker.js';

/** Every day at 07:00 India time (spec 2026-11-10-price-alerts). */
export const priceAlertSchedule = { pattern: '0 7 * * *', tz: 'Asia/Kolkata' };
const QUEUE = 'price-alerts';

const errorLine = (what: string) => (err: Error) => console.error(`[alerts] ${what}: ${err.message}`);

/**
 * Runs the price-alert check on a BullMQ job scheduler in the API process. Redis makes sure each day's
 * run happens once, even with several API instances. Off when `REDIS_URL` isn't set (tests).
 *
 * Set-up runs in the background: if Redis is down when the API starts, the API still starts (and
 * serves everything that doesn't need Redis); the scheduler connects when Redis comes back.
 */
@Injectable()
export class PriceAlertScheduler implements OnModuleInit, OnApplicationShutdown {
  private queue?: Queue;
  private worker?: Worker;
  private connections: Redis[] = [];

  constructor(
    private readonly checker: PriceAlertChecker,
    @Inject(CLOCK) private readonly clock: Clock = () => new Date(),
  ) {}

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) return;
    const connect = (opts: RedisOptions, what: string) => {
      const c = new Redis(url, opts);
      c.on('error', errorLine(`redis (${what})`));
      this.connections.push(c);
      return c;
    };
    // Queue commands give up after a few tries instead of waiting forever; workers need null (BullMQ).
    this.queue = new Queue(QUEUE, { connection: connect({ maxRetriesPerRequest: 3 }, 'queue') });
    this.queue.on('error', errorLine('queue'));
    void this.queue
      .upsertJobScheduler(QUEUE, priceAlertSchedule, {
        name: 'check',
        opts: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
          removeOnComplete: 30,
          removeOnFail: 30,
        },
      })
      .catch(errorLine('could not register the daily 07:00 check (will retry on next start)'));
    this.worker = new Worker(
      QUEUE,
      async () => {
        const r = await this.checker.runOnce(this.clock());
        console.log(
          `[alerts] checked ${r.checked}, emailed ${r.notified}, expired ${r.expired}, failed ${r.failed}`,
        );
        return r;
      },
      { connection: connect({ maxRetriesPerRequest: null }, 'worker') },
    );
    this.worker.on('error', errorLine('worker'));
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([this.worker?.close(true), this.queue?.close()]);
    this.connections.forEach((c) => c.disconnect());
  }
}
