import { describe, expect, test } from 'vitest';
import { fixedClock } from '../src/clock.js';
import { MockBusProvider, MockFlightProvider, MockTrainProvider } from '../src/mock/transport.js';
import { MOCK_DESTINATIONS, MOCK_ORIGINS } from '../src/mock/data/places.js';
import { expectPricedOffer } from './helpers.js';

const clock = fixedClock('2026-11-08T10:00:00Z');
const travellers = { adults: 2, childAges: [3, 6] };
const train = new MockTrainProvider(clock);
const bus = new MockBusProvider(clock);
const flight = new MockFlightProvider(clock);

describe('MockTrainProvider', () => {
  test('Kolkata → Goa on Tue 1 Dec: priced for the group with IRCTC links that admit no pre-fill', async () => {
    const offers = await train.search({ from: 'KOL', to: 'GOA', date: '2026-12-01', travellers });
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expectPricedOffer(o);
      expect(o.source).toBe('mock-train');
      expect(o.prefilled).toBe(false);
      expect(o.fetchedAt).toBe('2026-11-08T10:00:00.000Z');
      expect(o.arriveDate > o.departDate).toBe(true);
    }
    const threeA = offers.find((o) => o.travelClass === '3A')!;
    const f = threeA.breakdown![0]!.unitAmount;
    expect(threeA.breakdown!.map((l) => l.amount)).toEqual([2 * f, 0, Math.round(f / 2)]);
    expect(threeA.price.amount).toBe(2 * f + Math.round(f / 2));
  });

  test('trains do not run every day, so the month grid has gaps', async () => {
    const grid = await train.cheapestByDate({ from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers });
    expect(Object.keys(grid)).toHaveLength(31);
    expect(Object.values(grid).some((o) => o === undefined)).toBe(true);
    expect(Object.values(grid).some((o) => o !== undefined)).toBe(true);
  });

  test('class filter limits the grid to the requested classes', async () => {
    const grid = await train.cheapestByDate({
      from: 'KOL',
      to: 'GOA',
      year: 2026,
      month: 12,
      travellers,
      classes: ['2A'],
    });
    for (const o of Object.values(grid)) if (o) expect(o.travelClass).toBe('2A');
  });

  test('booking window: 60 days ahead, Tatkal 10:00 AC / 11:00 non-AC', () => {
    expect(train.bookingWindow()).toEqual({
      advanceDays: 60,
      tatkalAcOpens: '10:00',
      tatkalNonAcOpens: '11:00',
    });
  });
});

describe('MockBusProvider', () => {
  test('no direct bus from Kolkata to Goa', async () => {
    expect(await bus.search({ from: 'KOL', to: 'GOA', date: '2026-12-01', travellers })).toEqual([]);
  });

  test('Kolkata → Darjeeling has buses with redBus links', async () => {
    const offers = await bus.search({ from: 'KOL', to: 'DARJEELING', date: '2026-12-01', travellers });
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) expect(o.bookingUrl).toContain('redbus.in');
  });
});

describe('MockFlightProvider', () => {
  test('flies every day of the month', async () => {
    const grid = await flight.cheapestByDate({ from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers });
    expect(Object.values(grid).every((o) => o !== undefined)).toBe(true);
  });

  test("uses the airline's own child fares (75% of adult), so prices are not estimates", async () => {
    const [o] = await flight.search({ from: 'KOL', to: 'GOA', date: '2026-12-01', travellers });
    const adult = o!.breakdown![0]!.unitAmount;
    expect(o!.isEstimate).toBe(false);
    expect(o!.breakdown!.slice(1).map((l) => l.amount)).toEqual([
      Math.round(adult * 0.75),
      Math.round(adult * 0.75),
    ]);
  });
});

describe('contract: every route in both directions', () => {
  test('all offers carry source, price, freshness and a booking link', async () => {
    for (const origin of MOCK_ORIGINS)
      for (const dest of MOCK_DESTINATIONS)
        for (const [from, to] of [
          [origin.code, dest.code],
          [dest.code, origin.code],
        ] as const)
          for (const p of [train, bus, flight])
            for (const o of await p.search({ from, to, date: '2026-12-01', travellers }))
              expectPricedOffer(o);
  });

  test('deterministic: the same query twice gives identical results', async () => {
    const q = { from: 'DEL', to: 'MANALI', date: '2026-12-12', travellers };
    expect(await bus.search(q)).toEqual(await bus.search(q));
    expect(await flight.search(q)).toEqual(await flight.search(q));
  });
});
