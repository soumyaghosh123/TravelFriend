import { describe, expect, test } from 'vitest';
import { fixedClock } from '../src/clock.js';
import { buildHotelsSection } from '../src/hotels-section.js';
import { createRegistry } from '../src/registry.js';

const clock = fixedClock('2026-11-08T06:00:00Z');
const set = createRegistry({}, clock);
const opts = { clock, timeoutMs: 4000 };
const family = { adults: 2, childAges: [3, 6], rooms: 1 };

describe('buildHotelsSection — Goa, 9 → 16 Dec 2026, 2 adults + kids 3 and 6, 1 room', () => {
  const section = buildHotelsSection(set, { to: 'GOA', checkIn: '2026-12-09', checkOut: '2026-12-16', travellers: family, stayNear: 'Calangute' }, opts);

  test('stay details: 7 nights, 1 room, no extra bed; the landmark the user asked for', async () => {
    const s = await section;
    expect(s).toMatchObject({ nights: 7, rooms: 1, extraBeds: 0, landmark: { name: 'Calangute Beach', matched: true } });
    expect(s.destination).toEqual({ code: 'GOA', name: 'Goa' });
    expect(s.sampleData).toBe(true);
  });

  test('every hotel type is listed (the UI filters), each with per-site prices and the cheapest highlighted', async () => {
    const { hotels } = await section;
    expect(new Set(hotels.map((h) => h.type))).toEqual(new Set(['budget', 'hostel', '3star', '4star', '5star', 'homestay', 'resort']));
    for (const h of hotels) {
      expect(h.sitePrices.length).toBeGreaterThanOrEqual(3);
      expect(h.cheapest.price.amount).toBe(Math.min(...h.sitePrices.map((p) => p.price.amount)));
      expect(h.totalPrice).toBe(h.cheapest.price.amount);
      expect(h.perNight).toBe(Math.round(h.totalPrice / 7));
      expect(h.nights).toBe(7);
    }
  });

  test('booking links are pre-filled with dates and guests where the site supports it', async () => {
    const { hotels } = await section;
    const booking = hotels.flatMap((h) => h.sitePrices).find((p) => p.site === 'booking')!;
    expect(booking.prefilled).toBe(true);
    expect(booking.bookingUrl).toContain('checkin=2026-12-09');
    expect(booking.bookingUrl).toContain('checkout=2026-12-16');
    expect(booking.bookingUrl).toContain('group_adults=2');
    expect(booking.bookingUrl).toContain('group_children=2');
  });

  test('distances are from Calangute Beach, and some hotels are close to it', async () => {
    const { hotels } = await section;
    for (const h of hotels) expect(h.distanceKm).toBeGreaterThanOrEqual(0);
    expect(hotels.some((h) => h.distanceKm! <= 3)).toBe(true);
  });

  test('restaurant prices appear for hotels with a restaurant', async () => {
    const { hotels } = await section;
    for (const h of hotels) expect(!!h.restaurant).toBe(h.amenities.includes('Restaurant'));
    expect(hotels.find((h) => h.restaurant)!.restaurant!.costForTwo).toBeGreaterThan(0);
  });

  test('a price hint compares these nights with the month', async () => {
    const { priceHint } = await section;
    expect(priceHint).not.toBeNull();
    expect(['lower', 'usual', 'higher']).toContain(priceHint!.level);
  });
});

describe('buildHotelsSection — edge cases', () => {
  test('unknown "stay near" falls back to the main area, marked as not matched', async () => {
    const s = await buildHotelsSection(set, { to: 'GOA', checkIn: '2026-12-09', checkOut: '2026-12-12', travellers: family, stayNear: 'Airport lounge' }, opts);
    expect(s.landmark).toEqual({ name: 'Calangute Beach', matched: false });
  });

  test('three adults in one room → one extra bed, and it costs more than two adults', async () => {
    const two = await buildHotelsSection(set, { to: 'GOA', checkIn: '2026-12-09', checkOut: '2026-12-12', travellers: { adults: 2, childAges: [], rooms: 1 } }, opts);
    const three = await buildHotelsSection(set, { to: 'GOA', checkIn: '2026-12-09', checkOut: '2026-12-12', travellers: { adults: 3, childAges: [], rooms: 1 } }, opts);
    expect(three.extraBeds).toBe(1);
    const id = two.hotels[0]!.hotelId;
    expect(three.hotels.find((h) => h.hotelId === id)!.extraBeds).toBe(1);
    expect(three.hotels.find((h) => h.hotelId === id)!.totalPrice).toBeGreaterThan(two.hotels[0]!.totalPrice);
  });

  test('no night at the destination → no hotels', async () => {
    const s = await buildHotelsSection(set, { to: 'GOA', checkIn: '2026-12-09', checkOut: '2026-12-09', travellers: family }, opts);
    expect(s.nights).toBe(0);
    expect(s.hotels).toEqual([]);
  });
});
