import 'reflect-metadata';
import { afterEach, expect, test } from 'vitest';
import { InMemoryAccountStore } from '../src/account/account-store.js';
import { PriceAlertChecker } from '../src/worker/price-alert-checker.js';
import { PriceAlertScheduler } from '../src/worker/price-alert-scheduler.js';

const before = process.env.REDIS_URL;
afterEach(() => {
  process.env.REDIS_URL = before;
});

test('Redis down at start: the scheduler does not hold up the API booting', async () => {
  process.env.REDIS_URL = 'redis://127.0.0.1:1'; // nothing listens here
  const checker = new PriceAlertChecker(
    new InMemoryAccountStore(),
    { price: async () => ({ kind: 'unavailable' }) },
    { send: async () => {} },
    'http://localhost:3000',
  );
  const s = new PriceAlertScheduler(checker);
  const started = Date.now();
  await s.onModuleInit();
  expect(Date.now() - started).toBeLessThan(1000);
  await s.onApplicationShutdown();
}, 10_000);
