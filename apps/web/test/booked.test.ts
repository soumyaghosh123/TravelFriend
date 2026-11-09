import { describe, expect, test } from 'vitest';
import { bookedKey, loadBooked, saveBooked, type KeyValueStore } from '../lib/booked';

// PLAN §12 step 9, done when: "checklist ticks persist" (localStorage in the MVP).
function memory(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe('booked ticks', () => {
  test('saved ticks come back after a reload', () => {
    const store = memory();
    const key = bookedKey('s1', 'budget', '2026-12-01');
    saveBooked(store, key, new Set(['onward', 'hotel-calangute-beach']));
    expect(loadBooked(store, key)).toEqual(new Set(['onward', 'hotel-calangute-beach']));
  });

  test('each search, plan and start date has its own list', () => {
    const store = memory();
    saveBooked(store, bookedKey('s1', 'budget', '2026-12-01'), new Set(['onward']));
    expect(loadBooked(store, bookedKey('s1', 'comfort', '2026-12-01')).size).toBe(0);
    expect(loadBooked(store, bookedKey('s1', 'budget', '2026-12-02')).size).toBe(0);
    expect(loadBooked(store, bookedKey('s2', 'budget', '2026-12-01')).size).toBe(0);
  });

  test('broken or blocked storage never throws', () => {
    const store = memory();
    store.data.set('k', '{not json');
    expect(loadBooked(store, 'k').size).toBe(0);
    store.data.set('k', JSON.stringify({ a: 1 }));
    expect(loadBooked(store, 'k').size).toBe(0);
    expect(loadBooked(null, 'k').size).toBe(0);
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(() => saveBooked(full, 'k', new Set(['x']))).not.toThrow();
  });
});
