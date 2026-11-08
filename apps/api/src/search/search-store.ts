import { randomUUID } from 'node:crypto';
import type { ValidSearchInput } from '@tripsaver/domain';

export interface StoredSearch {
  id: string;
  input: ValidSearchInput;
  createdAt: string;
}

/** Where accepted searches live until their results are built. Redis-backed later (PLAN §7). */
export interface SearchStore {
  save(input: ValidSearchInput, now: Date): Promise<StoredSearch>;
  get(id: string): Promise<StoredSearch | undefined>;
}

/** Process-local store with a size cap; fine for development and tests. */
export class InMemorySearchStore implements SearchStore {
  private readonly items = new Map<string, StoredSearch>();

  constructor(private readonly maxItems = 1000) {}

  async save(input: ValidSearchInput, now: Date): Promise<StoredSearch> {
    const stored: StoredSearch = { id: randomUUID(), input, createdAt: now.toISOString() };
    this.items.set(stored.id, stored);
    if (this.items.size > this.maxItems) {
      const oldest = this.items.keys().next().value;
      if (oldest !== undefined) this.items.delete(oldest);
    }
    return stored;
  }

  async get(id: string): Promise<StoredSearch | undefined> {
    return this.items.get(id);
  }
}
