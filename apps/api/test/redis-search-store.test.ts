import { makeSearchInputSchema } from '@tripsaver/domain';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { RedisSearchStore, SEARCH_TTL_SECONDS } from '../src/search/redis-search-store.js';

// Runs against the docker-compose Redis (pnpm db:up). Skipped when it isn't reachable.
const url = process.env.REDIS_TEST_URL ?? 'redis://localhost:6379';
let redis: Redis | null = null;

beforeAll(async () => {
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 0, retryStrategy: () => null });
  try {
    await client.connect();
    await client.ping();
    redis = client;
  } catch {
    client.disconnect();
  }
});

afterAll(async () => {
  await redis?.quit();
});

const input = makeSearchInputSchema('2026-11-08').parse({
  from: 'KOL',
  to: 'GOA',
  days: 10,
  month: '2026-12',
  hotelTypes: ['3-star'],
  travellers: { adults: 2, childAges: [3, 6] },
});

describe('RedisSearchStore', () => {
  test('saves and reads back a search, with a 30-day expiry', async (ctx) => {
    if (!redis) return ctx.skip();
    const prefix = `tripsaver:test:${Date.now()}:`;
    const store = new RedisSearchStore(redis, prefix);
    const saved = await store.save(input, new Date('2026-11-08T06:00:00Z'));
    expect(await store.get(saved.id)).toEqual(saved);
    const ttl = await redis.ttl(prefix + saved.id);
    expect(ttl).toBeGreaterThan(SEARCH_TTL_SECONDS - 10);
    await redis.del(prefix + saved.id);
  });

  test('unknown id → undefined', async (ctx) => {
    if (!redis) return ctx.skip();
    expect(await new RedisSearchStore(redis, 'tripsaver:test:none:').get('missing')).toBeUndefined();
  });

  test('a new store instance (an API restart) still finds the search', async (ctx) => {
    if (!redis) return ctx.skip();
    const prefix = `tripsaver:test:${Date.now()}:restart:`;
    const saved = await new RedisSearchStore(redis, prefix).save(input, new Date());
    expect((await new RedisSearchStore(redis, prefix).get(saved.id))?.input).toEqual(input);
    await redis.del(prefix + saved.id);
  });
});
