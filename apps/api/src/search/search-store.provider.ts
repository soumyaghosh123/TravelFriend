import type { OnApplicationShutdown, Provider } from '@nestjs/common';
import { Redis } from 'ioredis';
import { SEARCH_STORE } from '../tokens.js';
import { RedisSearchStore } from './redis-search-store.js';
import { InMemorySearchStore, type SearchStore } from './search-store.js';

/** Closes the Redis connection when Nest shuts down. */
class ClosableRedisStore extends RedisSearchStore implements OnApplicationShutdown {
  constructor(private readonly client: Redis) {
    super(client);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.quit();
  }
}

/** Redis when `REDIS_URL` is set (dev via docker compose, production); in-memory otherwise (tests). */
export function searchStoreProvider(env: Record<string, string | undefined> = process.env): Provider {
  return {
    provide: SEARCH_STORE,
    useFactory: (): SearchStore => {
      if (!env.REDIS_URL) return new InMemorySearchStore();
      const client = new Redis(env.REDIS_URL, { lazyConnect: false, maxRetriesPerRequest: 2 });
      client.on('error', (err) => console.error('[redis]', err.message));
      return new ClosableRedisStore(client);
    },
  };
}
