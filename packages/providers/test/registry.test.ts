import { describe, expect, test } from 'vitest';
import { createRegistry, type Factories } from '../src/registry.js';
import { fixedClock } from '../src/clock.js';
import type { Clock } from '../src/clock.js';

const clock = fixedClock('2026-11-08T10:00:00Z');

function stub(mode: string) {
  return (c: Clock) => ({ id: `stub-${mode}`, name: mode, mode, at: c().toISOString() }) as never;
}

const stubFactories: Partial<Factories> = {
  train: { mock: stub('train') },
  bus: { mock: stub('bus') },
  flight: { mock: stub('flight') },
  hotel: { mock: stub('hotel') },
  calendar: { mock: stub('calendar') },
  weather: { mock: stub('weather') },
};

describe('createRegistry', () => {
  test('defaults every mode to the mock provider and passes the clock', () => {
    const set = createRegistry({}, clock, stubFactories);
    for (const mode of ['train', 'bus', 'flight', 'hotel', 'calendar', 'weather'] as const) {
      expect(set[mode].map((p) => p.id)).toEqual([`stub-${mode}`]);
    }
    expect((set.train[0] as unknown as { at: string }).at).toBe('2026-11-08T10:00:00.000Z');
  });

  test('unknown provider ids fail loudly, naming the variable', () => {
    expect(() => createRegistry({ HOTEL_PROVIDERS: 'mock,agoda' }, clock, stubFactories)).toThrow(
      /Unknown provider "agoda" in HOTEL_PROVIDERS/,
    );
  });

  test('whitespace and empty entries are ignored', () => {
    expect(createRegistry({ TRAIN_PROVIDERS: ' mock , ' }, clock, stubFactories).train).toHaveLength(1);
  });
});

describe('fixedClock', () => {
  test('always returns the same instant', () => {
    expect(clock().toISOString()).toBe(clock().toISOString());
  });
});
