import { computeWindows, topWindows } from '@tripsaver/domain';
import { describe, expect, test } from 'vitest';
import { buildCheapestDatesInput, priceWindow } from '../src/assemble.js';
import { fixedClock } from '../src/clock.js';
import { createRegistry } from '../src/registry.js';

describe('priceWindow: a date window priced with real, bookable offers', () => {
  const set = createRegistry({}, fixedClock('2026-11-08T10:00:00Z'));
  const args = {
    from: 'KOL',
    to: 'GOA',
    year: 2026,
    month: 12,
    days: 10,
    travellers: { adults: 2, childAges: [3, 6], rooms: 1 },
    style: 'budget' as const,
    localPerDay: 1750,
  };

  test('components are the legs the engine chose, one hotel for the whole stay, and they add up', async () => {
    const windows = computeWindows(await buildCheapestDatesInput(set, args));
    const best = topWindows(windows)[0]!;
    const p = await priceWindow(set, args, best);

    expect(p.onward.departDate).toBe(best.legs!.onward.departDate);
    expect(p.onward.price.amount).toBe(best.breakdown.onward);
    expect(p.return.price.amount).toBe(best.breakdown.return);
    expect(p.return.arriveDate <= best.end).toBe(true);

    expect(p.hotel).not.toBeNull();
    expect(p.hotel!.nights).toBe(best.hotelNights);
    expect(p.hotel!.guestRating).toBeGreaterThanOrEqual(3.5);

    expect(p.local).toEqual({ perDay: 1750, days: best.daysAtDestination, amount: 1750 * best.daysAtDestination });
    expect(p.total).toBe(p.onward.price.amount + p.return.price.amount + p.hotel!.cheapest.price.amount + p.local.amount);
    expect(p.perPerson).toBe(Math.round(p.total / 4));
  });

  test('every bookable component has a source, fetchedAt and a pre-filled booking link', async () => {
    const best = topWindows(computeWindows(await buildCheapestDatesInput(set, args)))[0]!;
    const p = await priceWindow(set, args, best);
    for (const offer of [p.onward, p.return, p.hotel!.cheapest]) {
      expect(offer.sourceName).toBeTruthy();
      expect(offer.fetchedAt).toBe('2026-11-08T10:00:00.000Z');
      expect(offer.bookingUrl).toMatch(/^https:\/\//);
    }
    expect(p.hotel!.cheapest.bookingUrl).toContain(best.legs!.onward.arriveDate);
  });

  test('the priced hotel is never below the per-night estimate (one hotel ≥ cheapest hotel each night)', async () => {
    const top = topWindows(computeWindows(await buildCheapestDatesInput(set, args)));
    for (const w of top) {
      const p = await priceWindow(set, args, w);
      expect(p.hotel!.cheapest.price.amount).toBeGreaterThanOrEqual(Math.round(w.breakdown.hotel * 0.97) - 1);
    }
  });

  test('an infeasible window is rejected', async () => {
    const w = { ...topWindows(computeWindows(await buildCheapestDatesInput(set, args)))[0]!, feasible: false, legs: undefined };
    await expect(priceWindow(set, args, w)).rejects.toThrow(/not feasible/);
  });
});
