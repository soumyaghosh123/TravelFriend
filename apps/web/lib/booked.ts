/** The browser storage we need (window.localStorage, or a fake in tests). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** One checklist per search, plan and start date: ticking the Budget plan doesn't tick Comfort's hotel. */
export function bookedKey(searchId: string, style: string, start: string): string {
  return `tripsaver:booked:${searchId}:${style}:${start}`;
}

/** Ticked checklist rows; anything unreadable counts as nothing ticked. */
export function loadBooked(store: KeyValueStore | null, key: string): Set<string> {
  try {
    const raw = store?.getItem(key);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export function saveBooked(store: KeyValueStore | null, key: string, ids: ReadonlySet<string>): void {
  try {
    store?.setItem(key, JSON.stringify([...ids].sort()));
  } catch {
    // Storage full or blocked (private mode): ticks just won't persist.
  }
}
