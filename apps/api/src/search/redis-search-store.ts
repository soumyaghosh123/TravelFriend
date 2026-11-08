import { randomUUID } from 'node:crypto';
import type { ValidSearchInput } from '@tripsaver/domain';
import type { Redis } from 'ioredis';
import type { SearchStore, StoredSearch } from './search-store.js';

/** How long a search (and its result page link) stays available. */
export const SEARCH_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Searches in Redis, so result pages survive API restarts and work across instances. */
export class RedisSearchStore implements SearchStore {
  constructor(
    private readonly redis: Redis,
    private readonly prefix = 'tripsaver:search:',
    private readonly ttlSeconds = SEARCH_TTL_SECONDS,
  ) {}

  async save(input: ValidSearchInput, now: Date): Promise<StoredSearch> {
    const stored: StoredSearch = { id: randomUUID(), input, createdAt: now.toISOString() };
    await this.redis.set(this.prefix + stored.id, JSON.stringify(stored), 'EX', this.ttlSeconds);
    return stored;
  }

  async get(id: string): Promise<StoredSearch | undefined> {
    const raw = await this.redis.get(this.prefix + id);
    return raw ? (JSON.parse(raw) as StoredSearch) : undefined;
  }
}
