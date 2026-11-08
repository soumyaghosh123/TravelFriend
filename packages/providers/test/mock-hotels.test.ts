import { describe, expect, test } from 'vitest';
import { eachDay } from '@tripsaver/domain';
import { fixedClock } from '../src/clock.js';
import { MockHotelProvider } from '../src/mock/hotels.js';
import { MOCK_HOTELS, type MockHotel } from '../src/mock/data/hotels.js';
import { MOCK_DESTINATIONS } from '../src/mock/data/places.js';
import { expectPricedOffer } from './helpers.js';

const clock = fixedClock('2026-11-08T10:00:00Z');
const travellers = { adults: 2, childAges: [3, 6] };
const hotels = new MockHotelProvider(clock);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('MOCK_HOTELS catalogue', () => {
  test('every destination: ≥ 15 hotels, all 7 types, ≥ 3 five-star, ≥ 3 rated under 3.5', () => {
    for (const d of MOCK_DESTINATIONS) {
      const list = MOCK_HOTELS[d.code]!;
      expect(list.length).toBeGreaterThanOrEqual(15);
      expect(new Set(list.map((h) => h.type)).size).toBe(7);
      expect(list.filter((h) => h.stars === 5).length).toBeGreaterThanOrEqual(3);
      expect(list.filter((h) => h.guestRating < 3.5).length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('MockHotelProvider.search', () => {
  const q = { destination: 'GOA', checkIn: '2026-12-02', checkOut: '2026-12-09', travellers };

  test('7-night Goa stay: per-site prices, cheapest highlighted, honest pre-fill', async () => {
    const offers = await hotels.search(q);
    expect(offers.length).toBeGreaterThanOrEqual(15);
    for (const h of offers) {
      expect(h.nights).toBe(7);
      expect(h.sitePrices.length).toBeGreaterThanOrEqual(3);
      expect(h.cheapest.price.amount).toBe(Math.min(...h.sitePrices.map((s) => s.price.amount)));
      for (const s of h.sitePrices) {
        expectPricedOffer(s);
        if (['booking', 'agoda', 'expedia'].includes(s.site)) {
          expect(s.prefilled).toBe(true);
          expect(s.bookingUrl).toContain('2026-12-02');
        } else {
          expect(s.prefilled).toBe(false);
        }
      }
    }
  });

  test('type filter returns only 5-star hotels', async () => {
    const offers = await hotels.search({ ...q, types: ['5star'] });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((h) => h.stars === 5)).toBe(true);
  });

  test('deterministic', async () => {
    expect(await hotels.search(q)).toEqual(await hotels.search(q));
  });
});

describe('MockHotelProvider.nightlyGroupPrice', () => {
  test('31 nights for Goa 3-star in December, peak far dearer than early month', async () => {
    const grid = await hotels.nightlyGroupPrice('GOA', 2026, 12, travellers, '3star');
    expect(Object.keys(grid)).toHaveLength(31);
    const early = mean(eachDay('2026-12-01', '2026-12-10').map((d) => grid[d]!));
    const late = mean(eachDay('2026-12-21', '2026-12-30').map((d) => grid[d]!));
    expect(late).toBeGreaterThan(1.5 * early);
  });

  test('hotels rated under 3.5 never set the nightly price', async () => {
    const poor: MockHotel = { ...MOCK_HOTELS.GOA!.find((h) => h.type === '3star')!, guestRating: 3.4 };
    const stub = new MockHotelProvider(clock, { GOA: [poor] });
    expect(await stub.nightlyGroupPrice('GOA', 2026, 12, travellers, '3star')).toEqual({});
  });
});
