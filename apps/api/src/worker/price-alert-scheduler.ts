import { Injectable, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { PriceAlertChecker } from './price-alert-checker.js';

/** Every day at 07:00 India time (spec 2026-11-10-price-alerts). */
export const priceAlertSchedule = { pattern: '0 7 * * *', tz: 'Asia/Kolkata' };
const QUEUE = 'price-alerts';

/**
 * Runs the price-alert check on a BullMQ job scheduler in the API process. Redis makes sure each day's
 * run happens once, even with several API instances. Off when `REDIS_URL` isn't set (tests).
 */
@Injectable()
export class PriceAlertScheduler implements OnModuleInit, OnApplicationShutdown {
  private queue?: Queue;
  private worker?: Worker;
  private connections: Redis[] = [];

  constructor(private readonly checker: PriceAlertChecker) {}

  async onModuleInit(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) return;
    const connect = () => {
      // BullMQ workers need maxRetriesPerRequest: null.
      const c = new Redis(url, { maxRetriesPerRequest: null });
      c.on('error', (err) => console.error('[alerts redis]', err.message));
      this.connections.push(c);
      return c;
    };
    this.queue = new Queue(QUEUE, { connection: connect() });
    await this.queue.upsertJobScheduler(QUEUE, priceAlertSchedule, { name: 'check' });
    this.worker = new Worker(
      QUEUE,
      async () => {
        const r = await this.checker.runOnce(new Date());
        console.log(
          `[alerts] checked ${r.checked}, emailed ${r.notified}, expired ${r.expired}, failed ${r.failed}`,
        );
        return r;
      },
      { connection: connect() },
    );
  }

  async onApplicationShutdown(): Promise<void> {
    await this.worker?.close();
    await this.queue?.close();
    await Promise.all(this.connections.map((c) => c.quit().catch(() => undefined)));
  }
}
