import { describe, expect, test } from 'vitest';
import { computeWindows } from '@tripsaver/domain';
import { buildCheapestDatesInput } from '../src/assemble.js';
import { fixedClock } from '../src/clock.js';
import { buildDeepLink } from '../src/deeplinks/index.js';
import { MockHotelProvider } from '../src/mock/hotels.js';
import { createRegistry } from '../src/registry.js';

const clock = fixedClock('2026-11-08T10:00:00Z');
const hotels = new MockHotelProvider(clock);
const t = { adults: 2, childAges: [3, 6] };
const args = {
  from: 'KOL',
  to: 'GOA',
  year: 2026,
  month: 12,
  days: 10,
  travellers: t,
  style: 'budget' as const,
  localPerDay: 1500,
};

describe('review #4: hotel stay dates', () => {
  test.each([['2026-12-05'], ['2026-12-03']])('checkOut %s on or before checkIn throws', async (checkOut) => {
    await expect(
      hotels.search({ destination: 'GOA', checkIn: '2026-12-05', checkOut, travellers: t }),
    ).rejects.toThrow(RangeError);
  });
});

describe('review #6: hotel path validates travellers', () => {
  const bad = { adults: 0, childAges: [-2, 40] };

  test('search, nightly grid and deep links reject bad head counts', async () => {
    await expect(
      hotels.search({ destination: 'GOA', checkIn: '2026-12-02', checkOut: '2026-12-09', travellers: bad }),
    ).rejects.toThrow(RangeError);
    await expect(hotels.nightlyGroupPrice('GOA', 2026, 12, bad, '3star')).rejects.toThrow(RangeError);
    expect(() =>
      buildDeepLink('booking', {
        kind: 'hotel',
        destinationName: 'Goa',
        checkIn: '2026-12-02',
        checkOut: '2026-12-09',
        travellers: bad,
      }),
    ).toThrow(RangeError);
  });

  test('rooms: 0 cannot make hotels free', async () => {
    await expect(hotels.nightlyGroupPrice('GOA', 2026, 12, { ...t, rooms: 0 }, '3star')).rejects.toThrow(
      RangeError,
    );
  });
});

describe('review #7: unknown places and missing hotels fail loudly', () => {
  test('unknown destination', async () => {
    const set = createRegistry({}, clock);
    await expect(buildCheapestDatesInput(set, { ...args, to: 'XYZ' })).rejects.toThrow(/Unknown place "XYZ"/);
  });

  test('no hotels of the needed type', async () => {
    const empty = createRegistry({}, clock, { hotel: { mock: (c) => new MockHotelProvider(c, {}) } });
    await expect(buildCheapestDatesInput(empty, args)).rejects.toThrow(/No hotels of type 3star in GOA/);
  });
});

describe('review #2 end to end: Goa windows keep their planned length', () => {
  test('a cheap overnight train home no longer shortens most windows', async () => {
    const ws = computeWindows(await buildCheapestDatesInput(createRegistry({}, clock), args));
    const shortened = ws.filter((w) => w.feasible && w.daysAtDestination < 8);
    expect(shortened.length).toBeLessThanOrEqual(2);
  });
});
