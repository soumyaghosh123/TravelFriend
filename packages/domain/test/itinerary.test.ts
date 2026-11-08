import { describe, expect, test } from 'vitest';
import { addDays, dayOfWeek } from '../src/dates.js';
import { splitBases } from '../src/itinerary/bases.js';
import { planItinerary, sightMinutesOf, toMin } from '../src/itinerary/plan.js';
import { nearestOffbeat, selectPlanAttractions } from '../src/itinerary/select.js';
import { daySpend, groupEntryFee } from '../src/itinerary/spend.js';
import type { AttractionLike, BaseCandidate, Itinerary, ItineraryInput } from '../src/itinerary/types.js';
import { ItineraryRuleError, validateItinerary } from '../src/itinerary/validate.js';

const CALANGUTE: BaseCandidate = { id: 'calangute', name: 'Calangute', lat: 15.544, lng: 73.755 };
const STATION = { lat: 15.27, lng: 73.96 }; // Madgaon

function sight(p: Partial<AttractionLike> & { id: string; lat: number; lng: number }): AttractionLike {
  return {
    name: p.id,
    category: 'sight',
    open: '09:00',
    close: '18:00',
    closedDays: [],
    durationMin: 90,
    bestTime: 'any',
    entryFee: 0,
    rating: 4.3,
    footfall: 'high',
    isOffbeat: false,
    isHighlight: false,
    ...p,
  };
}

// Goa-like: mostly near Calangute, one museum shut on Mondays, a Friday-only market,
// a sunset fort, a morning-only church, and a far-away offbeat sanctuary.
const GOA: AttractionLike[] = [
  sight({ id: 'baga', lat: 15.556, lng: 73.752, open: '00:00', close: '23:59', durationMin: 150, isHighlight: true }),
  sight({ id: 'aguada', lat: 15.492, lng: 73.773, open: '09:30', close: '18:00', durationMin: 90, isHighlight: true }),
  sight({ id: 'chapora', lat: 15.606, lng: 73.736, open: '00:00', close: '23:59', durationMin: 60, bestTime: 'evening' }),
  sight({ id: 'museum', lat: 15.497, lng: 73.828, open: '09:30', close: '17:30', closedDays: [1], durationMin: 90, entryFee: 50 }),
  sight({ id: 'mapusa', lat: 15.591, lng: 73.81, open: '08:00', close: '14:00', closedDays: [0, 1, 2, 3, 4, 6], durationMin: 120 }),
  sight({ id: 'bomjesus', lat: 15.501, lng: 73.912, open: '09:00', close: '18:30', bestTime: 'morning', durationMin: 90, isHighlight: true }),
  sight({ id: 'divar', lat: 15.52, lng: 73.89, durationMin: 150, rating: 4.4, footfall: 'low', isOffbeat: true }),
  sight({ id: 'netravali', lat: 15.08, lng: 74.21, open: '08:00', close: '17:00', durationMin: 180, rating: 4.5, footfall: 'low', isOffbeat: true, warnings: { network: 'Weak' } }),
  sight({ id: 'palolem', lat: 15.01, lng: 74.023, open: '00:00', close: '23:59', durationMin: 180 }),
  sight({ id: 'spice', lat: 15.42, lng: 74.02, open: '09:00', close: '16:30', durationMin: 150, entryFee: 600 }),
  sight({ id: 'anjuna', lat: 15.575, lng: 73.741, open: '00:00', close: '23:59', durationMin: 90 }),
  sight({ id: 'fontainhas', lat: 15.497, lng: 73.833, open: '00:00', close: '23:59', durationMin: 90 }),
];

/** Brief §12 shape: leave Kolkata Tue 1 Dec, arrive Madgaon 2 Dec 22:10, train home 9 Dec 09:15, home 10 Dec 21:30. */
function goaInput(over: Partial<ItineraryInput> = {}): ItineraryInput {
  const arrive = over.arrive ?? '2026-12-02T22:10';
  const leave = over.leave ?? '2026-12-09T09:15';
  const nights = Math.round((Date.parse(leave.slice(0, 10)) - Date.parse(arrive.slice(0, 10))) / 86_400_000);
  return {
    start: '2026-12-01',
    days: 10,
    arrive,
    leave,
    home: '2026-12-10T21:30',
    arrivalPoint: STATION,
    bases: splitBases([CALANGUTE], GOA, nights, arrive.slice(0, 10), STATION),
    attractions: GOA,
    ...over,
  };
}

const visits = (it: Itinerary) => it.days.flatMap((d) => d.stops.filter((s) => s.kind === 'visit').map((s) => ({ ...s, date: d.date })));

describe('planItinerary — 10 days, Kolkata → Goa by train', () => {
  const it = planItinerary(goaInput());

  test('N days → N distinct consecutive days', () => {
    expect(it.days).toHaveLength(10);
    expect(new Set(it.days.map((d) => d.date)).size).toBe(10);
    it.days.forEach((d, i) => expect(d.date).toBe(addDays('2026-12-01', i)));
  });

  test('day shapes: on the train, late arrival (check-in only), …, checkout + train home, on the train', () => {
    expect(it.days.map((d) => d.kind)).toEqual([
      'travel', 'arrival', 'sightseeing', 'sightseeing', 'free', 'sightseeing', 'sightseeing', 'sightseeing', 'departure', 'travel', // free day: the most central plain day (ties → earlier)
    ]);
    expect(it.days[1]!.stops.map((s) => s.kind)).toEqual(['to-hotel', 'check-in']); // arrives 22:10
  });

  test('no day over 9 active hours; Day 1 and Day N light', () => {
    for (const d of it.days) expect(d.activeMin).toBeLessThanOrEqual(9 * 60);
    expect(sightMinutesOf(it.days[1]!.stops)).toBeLessThanOrEqual(4 * 60);
    expect(sightMinutesOf(it.days[8]!.stops)).toBeLessThanOrEqual(3 * 60);
    expect(visits(it).filter((v) => v.date === '2026-12-01' || v.date === '2026-12-10')).toEqual([]);
  });

  test('no sight on its closed day or outside its hours; Friday market on Friday', () => {
    const byId = new Map(GOA.map((a) => [a.id, a]));
    for (const v of visits(it)) {
      const a = byId.get(v.attractionId!)!;
      expect(a.closedDays).not.toContain(dayOfWeek(v.date));
      expect(toMin(v.start)).toBeGreaterThanOrEqual(toMin(a.open));
      expect(toMin(v.start) + v.durationMin).toBeLessThanOrEqual(toMin(a.close));
    }
    expect(visits(it).find((v) => v.attractionId === 'mapusa')?.date).toBe('2026-12-04'); // the only Friday
  });

  test('best time of day: sunset fort in the evening, the church in the morning', () => {
    const v = visits(it);
    const chapora = v.find((x) => x.attractionId === 'chapora');
    if (chapora) expect(toMin(chapora.start)).toBeGreaterThanOrEqual(16 * 60 + 30);
    const church = v.find((x) => x.attractionId === 'bomjesus');
    if (church) expect(toMin(church.start)).toBeLessThanOrEqual(11 * 60 + 30);
  });

  test('every sight at most once; hotel nights are only the 7 nights in Goa', () => {
    const ids = visits(it).map((v) => v.attractionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(it.days.filter((d) => d.nightAt === 'calangute')).toHaveLength(7);
    expect(it.days.map((d) => d.nightAt).filter((n) => n === 'transit')).toHaveLength(2); // night 1 and night 9 on the train
    expect(it.days.at(-1)!.nightAt).toBe('home');
  });

  test('most sights fit; the rest are listed', () => {
    expect(visits(it).length + it.unscheduled.length).toBe(GOA.length);
    expect(visits(it).length).toBeGreaterThanOrEqual(9);
  });
});

describe('planItinerary — trip lengths and timings', () => {
  test('7 days or fewer: no free day', () => {
    const it = planItinerary(goaInput({ days: 7, leave: '2026-12-06T18:00', home: '2026-12-07T20:00' }));
    expect(it.days.some((d) => d.kind === 'free')).toBe(false);
  });

  test('flight arriving in the morning: Day 1 is a light arrival day with a few sights', () => {
    const it = planItinerary(goaInput({ start: '2026-12-02', days: 6, arrive: '2026-12-02T08:55', leave: '2026-12-07T15:00', home: '2026-12-07T18:00' }));
    expect(it.days[0]!.kind).toBe('arrival');
    expect(sightMinutesOf(it.days[0]!.stops)).toBeGreaterThan(0);
    expect(sightMinutesOf(it.days[0]!.stops)).toBeLessThanOrEqual(240);
    expect(it.days.at(-1)!.kind).toBe('departure');
  });

  test('an early flight home leaves no time for sights on the last day', () => {
    const it = planItinerary(goaInput({ start: '2026-12-02', days: 5, arrive: '2026-12-02T08:55', leave: '2026-12-06T06:10', home: '2026-12-06T09:00' }));
    const last = it.days.at(-1)!;
    expect(last.stops.filter((s) => s.kind === 'visit')).toEqual([]);
    expect(last.stops.map((s) => s.kind)).toEqual(['check-out', 'to-station']);
  });

  test('sweep: every trip length 2–15 and many arrival/departure times obey every rule (validator runs inside)', () => {
    let built = 0;
    for (let days = 2; days <= 15; days++) {
      for (const arriveHour of ['06:30', '11:00', '15:45', '21:00']) {
        for (const leaveHour of ['05:40', '12:30', '19:15']) {
          for (const travelDays of [0, 1]) {
            const arriveDate = addDays('2026-12-01', travelDays);
            const leaveDate = addDays('2026-12-01', days - 1 - travelDays);
            if (leaveDate < arriveDate) continue;
            const input = goaInput({ start: '2026-12-01', days, arrive: `${arriveDate}T${arriveHour}`, leave: `${leaveDate}T${leaveHour}`, home: `${addDays('2026-12-01', days - 1)}T23:00` });
            if (leaveDate === arriveDate && leaveHour <= arriveHour) continue;
            expect(() => planItinerary(input)).not.toThrow();
            built++;
          }
        }
      }
    }
    expect(built).toBeGreaterThan(150);
  });
});

describe('validateItinerary catches broken plans', () => {
  const input = goaInput();
  const good = planItinerary(input);
  const clone = (): Itinerary => JSON.parse(JSON.stringify(good));
  const rule = (it: Itinerary) => {
    try {
      validateItinerary(it, input);
      return null;
    } catch (e) {
      return (e as ItineraryRuleError).rule;
    }
  };

  test('a day over 9 hours', () => {
    const it = clone();
    it.days[3]!.activeMin = 9 * 60 + 1;
    expect(rule(it)).toBe('maxActive');
  });
  test('a sight on its closed day', () => {
    const it = clone();
    const monday = it.days.find((d) => dayOfWeek(d.date) === 1)!;
    monday.stops.push({ kind: 'visit', slot: 'morning', start: '10:00', durationMin: 60, active: true, attractionId: 'museum' });
    expect(['closedDay', 'duplicate']).toContain(rule(it));
  });
  test('a sight twice', () => {
    const it = clone();
    const v = it.days.flatMap((d) => d.stops).find((s) => s.kind === 'visit' && s.attractionId === 'baga')!;
    it.days[6]!.stops.push({ ...v });
    expect(['duplicate', 'openingHours', 'closedDay']).toContain(rule(it));
  });
  test('too few days, wrong hotel nights, or no free day on a long trip', () => {
    const short = clone();
    short.days.pop();
    expect(rule(short)).toBe('days');
    const nights = clone();
    nights.days[4]!.nightAt = 'transit';
    expect(rule(nights)).toBe('hotelNights');
    const noFree = clone();
    noFree.days.find((d) => d.kind === 'free')!.kind = 'sightseeing';
    expect(rule(noFree)).toBe('freeDay');
  });
});

describe('splitBases (regions)', () => {
  const KOCHI: BaseCandidate = { id: 'kochi', name: 'Fort Kochi', lat: 9.966, lng: 76.242 };
  const ALLEPPEY: BaseCandidate = { id: 'alleppey', name: 'Alleppey', lat: 9.498, lng: 76.339 };
  const MUNNAR: BaseCandidate = { id: 'munnar', name: 'Munnar', lat: 10.089, lng: 77.06 };
  const KERALA = [
    sight({ id: 'k1', lat: 9.96, lng: 76.24, durationMin: 240 }),
    sight({ id: 'k2', lat: 9.97, lng: 76.26, durationMin: 180 }),
    sight({ id: 'a1', lat: 9.5, lng: 76.34, durationMin: 240 }),
    sight({ id: 'm1', lat: 10.09, lng: 77.06, durationMin: 240 }),
    sight({ id: 'm2', lat: 10.1, lng: 77.08, durationMin: 240 }),
    sight({ id: 'm3', lat: 10.07, lng: 77.03, durationMin: 240 }),
  ];
  const COK = { lat: 10.15, lng: 76.4 };

  test('Goa: all candidates within 60 km → one base for every night', () => {
    const panjim: BaseCandidate = { id: 'panjim', name: 'Panjim', lat: 15.49, lng: 73.83 };
    expect(splitBases([CALANGUTE, panjim], GOA, 7, '2026-12-02', STATION).map((b) => [b.id, b.nights])).toHaveLength(1);
  });

  test('Kerala, 7 nights: Munnar and Kochi (Alleppey is too close to Kochi), ≥ 2 nights each, proportional to sights', () => {
    const s = splitBases([KOCHI, ALLEPPEY, MUNNAR], KERALA, 7, '2026-12-02', COK);
    expect(s.map((b) => b.id).sort()).toEqual(['kochi', 'munnar']);
    for (const b of s) expect(b.nights).toBeGreaterThanOrEqual(2);
    expect(s.reduce((n, b) => n + b.nights, 0)).toBe(7);
    expect(s.find((b) => b.id === 'munnar')!.nights).toBeGreaterThan(s.find((b) => b.id === 'kochi')!.nights);
    expect(s[1]!.checkIn).toBe(addDays(s[0]!.checkIn, s[0]!.nights));
  });

  test('few nights → one base', () => {
    expect(splitBases([KOCHI, MUNNAR], KERALA, 3, '2026-12-02', COK)).toHaveLength(1);
    expect(splitBases([KOCHI], KERALA, 0, '2026-12-02', COK)).toEqual([]);
  });

  test('two bases: a transfer day that moves base and still stays under 9 hours', () => {
    const bases = splitBases([KOCHI, MUNNAR], KERALA, 7, '2026-12-02', COK);
    const it = planItinerary({ start: '2026-12-02', days: 8, arrive: '2026-12-02T09:00', leave: '2026-12-09T16:00', arrivalPoint: COK, bases, attractions: KERALA });
    const transfer = it.days.find((d) => d.kind === 'transfer')!;
    expect(transfer.date).toBe(bases[1]!.checkIn);
    expect(transfer.stops.map((s) => s.kind).slice(0, 3)).toEqual(['check-out', 'move-base', 'check-in']);
    expect(transfer.activeMin).toBeLessThanOrEqual(540);
  });
});

describe('selectPlanAttractions', () => {
  test('offbeat: low-footfall spots rated 4+ plus the two best highlights', () => {
    const s = selectPlanAttractions('offbeat', GOA);
    expect(s.available).toBe(true);
    if (!s.available) return;
    expect(s.attractions.map((a) => a.id).sort()).toEqual(['aguada', 'baga', 'divar', 'netravali'].sort());
  });
  test('offbeat with no offbeat spots: say so instead of forcing a plan', () => {
    expect(selectPlanAttractions('offbeat', GOA.filter((a) => !a.isOffbeat))).toEqual({ available: false, reason: 'noOffbeat' });
  });
  test('budget skips pricey extras; comfort skips offbeat spots', () => {
    const budget = selectPlanAttractions('budget', GOA);
    const comfort = selectPlanAttractions('comfort', GOA);
    expect(budget.available && budget.attractions.some((a) => a.id === 'spice')).toBe(false);
    expect(comfort.available && comfort.attractions.some((a) => a.isOffbeat)).toBe(false);
  });
  test('nearest offbeat spot elsewhere', () => {
    expect(nearestOffbeat({ lat: 15.5, lng: 73.8 }, GOA)?.id).toBe('divar');
  });
});

describe('daySpend', () => {
  test('entry fees use the child bands: 3-year-old free, 6-year-old half', () => {
    expect(groupEntryFee(100, { adults: 2, childAges: [3, 6] })).toBe(250);
  });
  test('a day: entry + local travel by km + meals, estimates for the group', () => {
    const it = planItinerary(goaInput());
    const byId = new Map(GOA.map((a) => [a.id, a]));
    const s = daySpend(it.days[2]!, byId, { adults: 2, childAges: [3, 6] }, 'budget');
    expect(s.total).toBe(s.entry + s.local + s.meals);
    expect(s.meals).toBe(Math.round(2.5 * 400));
    expect(daySpend(it.days[0]!, byId, { adults: 2, childAges: [3, 6] }, 'budget').meals).toBe(Math.round(2.5 * 400 * 0.5));
  });
});
