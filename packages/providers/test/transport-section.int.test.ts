import { minutesBetween } from '@tripsaver/domain';
import { describe, expect, test } from 'vitest';
import { fixedClock } from '../src/clock.js';
import { createRegistry } from '../src/registry.js';
import { buildTransportSection, MAX_DURATION_FACTOR, MAX_WAIT_MIN, MIN_CONNECTION_MIN } from '../src/transport-section.js';

describe('buildTransportSection — Kolkata ⇄ Goa, out Tue 8 Dec, back Wed 16 Dec 2026, 2 adults + kids 3 and 6', () => {
  const clock = fixedClock('2026-11-08T06:00:00Z');
  const set = createRegistry({}, clock);
  const section = buildTransportSection(
    set,
    { from: 'KOL', to: 'GOA', onwardDate: '2026-12-08', returnDate: '2026-12-16', tripEnd: '2026-12-17', travellers: { adults: 2, childAges: [3, 6], rooms: 1 } },
    { clock, timeoutMs: 4000 },
  );

  test('both directions are listed, with names and dates', async () => {
    const s = await section;
    expect(s.onward).toMatchObject({ from: { code: 'KOL', name: 'Kolkata' }, to: { code: 'GOA', name: 'Goa' }, date: '2026-12-08' });
    expect(s.return).toMatchObject({ from: { code: 'GOA' }, to: { code: 'KOL' }, date: '2026-12-16' });
    expect(s.sampleData).toBe(true); // mock providers only
    for (const d of [s.onward, s.return]) {
      expect(d.services.length).toBeGreaterThan(0);
      for (const svc of d.services) for (const o of svc.offers) expect(o.departDate).toBe(d.date);
    }
  });

  test('a train is one service with an offer per class, cheapest first, each with fare and booking link', async () => {
    const s = await section;
    const train = s.onward.services.find((x) => x.number?.startsWith('18047'))!;
    expect(train.offers.map((o) => o.travelClass)).toEqual(['SL', '3A', '2A']);
    for (const o of train.offers) {
      expect(o.price.amount).toBeGreaterThan(0);
      expect(o.bookingUrl).toMatch(/^https:\/\//);
      expect(o.fetchedAt).toBe('2026-11-08T06:00:00.000Z');
    }
    const fares = train.offers.map((o) => o.price.amount);
    expect(fares).toEqual([...fares].sort((a, b) => a - b));
  });

  test('services are sorted by departure; there is no direct bus Kolkata → Goa', async () => {
    const s = await section;
    const departs = s.onward.services.map((x) => x.departAt);
    expect(departs).toEqual([...departs].sort());
    expect(s.onward.noDirect).toEqual(['bus']);
  });

  test('summary cards: cheapest is the lowest group fare, fastest the shortest trip, overnight a sleeper class', async () => {
    const { summary, services } = (await section).onward;
    const all = services.flatMap((x) => x.offers);
    expect(summary.cheapest!.price.amount).toBe(Math.min(...all.map((o) => o.price.amount)));
    expect(summary.fastest!.durationMin).toBe(Math.min(...all.map((o) => o.durationMin)));
    expect(['1A', '2A', '3A', 'SL', 'AC Sleeper']).toContain(summary.overnight!.travelClass);
  });

  test('combined routes change at a hub with a workable connection and beat every direct option on price or time', async () => {
    const { combined, services } = (await section).onward;
    expect(combined.length).toBeGreaterThan(0);
    const direct = services.flatMap((x) => x.offers);
    for (const c of combined) {
      expect(c.first.toPoint).toBeTruthy();
      expect(c.groupFare).toBe(c.first.price.amount + c.second.price.amount);
      expect(c.waitMin).toBeGreaterThanOrEqual(MIN_CONNECTION_MIN);
      expect(c.waitMin).toBeLessThanOrEqual(MAX_WAIT_MIN);
      expect(c.waitMin).toBe(minutesBetween(c.first.arriveAt, c.second.departAt));
      expect(direct.some((d) => d.price.amount <= c.groupFare && d.durationMin <= c.durationMin)).toBe(false);
    }
  });
});

describe('combined routes home respect the trip end and stay close to direct journey times', () => {
  test('no combined return arrives after the last day; none is more than 25% slower than the slowest direct', async () => {
    const clock = fixedClock('2026-11-08T06:00:00Z');
    const s = await buildTransportSection(
      createRegistry({}, clock),
      { from: 'KOL', to: 'GOA', onwardDate: '2026-12-08', returnDate: '2026-12-16', tripEnd: '2026-12-17', travellers: { adults: 2, childAges: [3, 6], rooms: 1 } },
      { clock, timeoutMs: 4000 },
    );
    for (const d of [s.onward, s.return]) {
      const slowest = Math.max(...d.services.map((x) => x.durationMin));
      for (const c of d.combined) expect(c.durationMin).toBeLessThanOrEqual(Math.round(slowest * MAX_DURATION_FACTOR));
    }
    for (const c of s.return.combined) expect(c.second.arriveAt.slice(0, 10) <= '2026-12-17').toBe(true);
  });
});
