import { describe, expect, test } from 'vitest';
import { minutesBetween } from '../src/dates.js';
import { priceForGroup } from '../src/pricing/group-price.js';
import { combineLegs, isOvernight, summarizeTransport, worthShowing, type TransportLike } from '../src/transport/transport.js';

const o = (p: Partial<TransportLike> & { id: string }): TransportLike & { id: string } => ({
  mode: 'train',
  travelClass: '3A',
  groupFare: 1000,
  departAt: '2026-12-08T10:00',
  arriveAt: '2026-12-08T20:00',
  durationMin: 600,
  ...p,
});

describe('minutesBetween (local date-times, no time zones)', () => {
  test('same day, across midnight and across months', () => {
    expect(minutesBetween('2026-12-08T10:00', '2026-12-08T11:30')).toBe(90);
    expect(minutesBetween('2026-12-08T22:00', '2026-12-09T06:00')).toBe(480);
    expect(minutesBetween('2026-12-31T23:00', '2027-01-01T01:00')).toBe(120);
  });
});

describe('isOvernight', () => {
  test('a sleeper class that travels through the night', () => {
    expect(isOvernight(o({ id: 'a', travelClass: '2A', departAt: '2026-12-08T21:30', arriveAt: '2026-12-09T07:50' }))).toBe(true);
    expect(isOvernight(o({ id: 'b', mode: 'bus', travelClass: 'AC Sleeper', departAt: '2026-12-08T19:00', arriveAt: '2026-12-09T09:00' }))).toBe(true);
  });
  test('day trips, seats and flights are not overnight options', () => {
    expect(isOvernight(o({ id: 'c' }))).toBe(false);
    expect(isOvernight(o({ id: 'd', mode: 'bus', travelClass: 'Non-AC Seater', departAt: '2026-12-08T21:00', arriveAt: '2026-12-09T08:00' }))).toBe(false);
    expect(isOvernight(o({ id: 'e', mode: 'flight', travelClass: 'Economy', departAt: '2026-12-08T23:30', arriveAt: '2026-12-09T01:30' }))).toBe(false);
  });
});

describe('summarizeTransport: cheapest, fastest, best overnight (mockup summary cards)', () => {
  const train3A = o({ id: '3A', groupFare: 6625, durationMin: 2055, departAt: '2026-12-08T11:55', arriveAt: '2026-12-09T22:10' });
  const train2A = o({ id: '2A', travelClass: '2A', groupFare: 9725, durationMin: 2055, departAt: '2026-12-08T11:55', arriveAt: '2026-12-09T22:10' });
  const flight = o({ id: 'F', mode: 'flight', travelClass: 'Economy', groupFare: 19800, durationMin: 165, departAt: '2026-12-08T06:10', arriveAt: '2026-12-08T08:55' });

  test('picks each card from the right option', () => {
    const s = summarizeTransport([flight, train2A, train3A]);
    expect(s.cheapest?.id).toBe('3A');
    expect(s.fastest?.id).toBe('F');
    expect(s.overnight?.id).toBe('2A'); // most comfortable sleeper (2A beats 3A)
  });

  test('fastest ties go to the cheaper option; empty input gives empty cards', () => {
    const slowCheap = o({ id: 'x', groupFare: 500, durationMin: 165, mode: 'flight', travelClass: 'Economy' });
    expect(summarizeTransport([flight, slowCheap]).fastest?.id).toBe('x');
    expect(summarizeTransport([])).toEqual({});
  });
});

describe('combineLegs: two-leg routes via a hub', () => {
  const toHub = [
    o({ id: 'T1', groupFare: 3000, departAt: '2026-12-08T06:00', arriveAt: '2026-12-09T08:00', durationMin: 1560 }),
    o({ id: 'F1', mode: 'flight', travelClass: 'Economy', groupFare: 12000, departAt: '2026-12-08T07:00', arriveAt: '2026-12-08T09:30', durationMin: 150 }),
  ];
  const fromHub = [
    o({ id: 'B1', mode: 'bus', travelClass: 'AC Sleeper', groupFare: 4000, departAt: '2026-12-09T19:00', arriveAt: '2026-12-10T07:00', durationMin: 720 }),
    o({ id: 'B0', mode: 'bus', travelClass: 'AC Sleeper', groupFare: 3500, departAt: '2026-12-09T08:30', arriveAt: '2026-12-09T20:30', durationMin: 720 }),
  ];

  test('needs at least the minimum connection time, and waits no longer than the maximum', () => {
    const combos = combineLegs(toHub, fromHub, { minConnectionMin: 120, maxWaitMin: 720 });
    const keys = combos.map((c) => `${c.first.id}+${c.second.id}`);
    expect(keys).toContain('T1+B1'); // arrive 08:00, leave 19:00 → 11 h wait
    expect(keys).not.toContain('T1+B0'); // only 30 min to connect
    expect(keys).not.toContain('F1+B1'); // 33.5 h wait
  });

  test('totals: fare, door-to-door duration and wait', () => {
    const [c] = combineLegs(toHub, fromHub, { minConnectionMin: 120, maxWaitMin: 720 });
    expect(c).toMatchObject({ groupFare: 7000, waitMin: 660, durationMin: minutesBetween('2026-12-08T06:00', '2026-12-10T07:00') });
  });

  test('cheapest combinations first', () => {
    const combos = combineLegs(toHub, fromHub, { minConnectionMin: 60, maxWaitMin: 2400 });
    expect(combos.map((c) => c.groupFare)).toEqual([...combos.map((c) => c.groupFare)].sort((a, b) => a - b));
  });
});

describe('fare breakdown lines carry the child age (for translated labels)', () => {
  test('age on child lines, none on the adult line', () => {
    const g = priceForGroup({ mode: 'train', providerId: 'x', adultUnitPrice: 1000, travellers: { adults: 2, childAges: [3, 6] } });
    expect(g.lines.map((l) => l.age)).toEqual([undefined, 3, 6]);
  });
});

describe('worthShowing: a combined route must beat every direct option on price or time', () => {
  test('drops combos that a direct option matches or beats on both', () => {
    const directTrain = o({ id: 'D', groupFare: 6000, durationMin: 2000 });
    const directFlight = o({ id: 'F', mode: 'flight', travelClass: 'Economy', groupFare: 20000, durationMin: 165 });
    const combos = [
      { groupFare: 9000, durationMin: 1800 }, // faster than the train, cheaper than the flight → keep
      { groupFare: 7000, durationMin: 2100 }, // dearer and slower than the train → drop
    ];
    expect(worthShowing(combos, [directTrain, directFlight])).toEqual([combos[0]]);
  });
  test('with no direct option every combo is worth showing', () => {
    expect(worthShowing([{ groupFare: 1, durationMin: 1 }], [])).toHaveLength(1);
  });
});

describe('combineLegs limits', () => {
  const a = o({ id: 'A', departAt: '2026-12-16T08:00', arriveAt: '2026-12-16T20:00', durationMin: 720 });
  const b = o({ id: 'B', departAt: '2026-12-17T06:00', arriveAt: '2026-12-18T10:00', durationMin: 1680 });
  test('arriveBy drops combinations that get in too late (e.g. after the trip ends)', () => {
    expect(combineLegs([a], [b], { minConnectionMin: 60, maxWaitMin: 720 })).toHaveLength(1);
    expect(combineLegs([a], [b], { minConnectionMin: 60, maxWaitMin: 720, arriveBy: '2026-12-17T23:59' })).toHaveLength(0);
  });
  test('maxDurationMin drops very long journeys', () => {
    expect(combineLegs([a], [b], { minConnectionMin: 60, maxWaitMin: 720, maxDurationMin: 2999 })).toHaveLength(0); // journey is exactly 3000 min
  });
});
