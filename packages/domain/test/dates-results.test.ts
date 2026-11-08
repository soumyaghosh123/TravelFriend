import { describe, expect, test } from 'vitest';
import { explainWindow, monthPeakWarning, nearbyCheaperMonth, type MonthComparison } from '../src/dates-engine/explain.js';
import { estimateLocalPerDay, LOCAL_PER_PERSON_PER_DAY } from '../src/dates-engine/local-estimate.js';
import { computeWindows, type CheapestDatesInput, type LegOption } from '../src/dates-engine/windows.js';
import { daysInMonth, isoDate } from '../src/dates.js';
import type { CalendarEvent, ISODate } from '../src/types.js';

function grid<T>(f: (d: ISODate) => T): Record<ISODate, T> {
  const out: Record<ISODate, T> = {};
  for (let d = 1; d <= daysInMonth(2026, 12); d++) out[isoDate(2026, 12, d)] = f(isoDate(2026, 12, d));
  return out;
}

describe('computeWindows reports the legs it chose', () => {
  test('onward and return legs carry their refs; hotel nights run from arrival to return departure', () => {
    const onward = (d: ISODate): LegOption => ({ departDate: d, arriveDate: d, groupFare: 1000, source: 's', ref: `on-${d}` });
    const cheapBack = (d: ISODate): LegOption => ({ departDate: d, arriveDate: d, groupFare: 900, source: 's', ref: `back-${d}` });
    const input: CheapestDatesInput = {
      year: 2026,
      month: 12,
      days: 5,
      onwardByDate: grid(onward),
      returnByDate: grid(cheapBack),
      nightlyGroupPrice: grid(() => 500),
      localPerDay: 0,
    };
    const w = computeWindows(input)[0]!;
    expect(w.legs?.onward.ref).toBe('on-2026-12-01');
    expect(w.legs?.return.ref).toBe('back-2026-12-05');
    expect(w.hotelNights).toBe(4);
  });

  test('infeasible windows have no legs', () => {
    const input: CheapestDatesInput = {
      year: 2026,
      month: 12,
      days: 5,
      onwardByDate: {},
      returnByDate: {},
      nightlyGroupPrice: {},
      localPerDay: 0,
    };
    expect(computeWindows(input)[0]!.legs).toBeUndefined();
  });
});

describe('explainWindow structured fields (for translation in the UI)', () => {
  const xmas: CalendarEvent = { name: 'Christmas–New Year peak', start: '2026-12-20', end: '2026-12-31', kind: 'season', priceImpact: 1.8 };
  const win = { start: '2026-12-18', end: '2026-12-27' } as const;

  test('event reasons carry the event; weekend reasons carry the night count', () => {
    const r = explainWindow({ ...win, feasible: true, total: 1, hotelNights: 9, daysAtDestination: 10, breakdown: { onward: 0, return: 0, hotel: 0, local: 0 }, band: 5 }, [xmas]);
    expect(r[0]).toMatchObject({ kind: 'season', event: { name: xmas.name, start: xmas.start, end: xmas.end, priceImpact: 1.8 } });
    expect(r.find((x) => x.kind === 'weekend')).toMatchObject({ nights: 4 }); // Fri 18, Sat 19, Fri 25, Sat 26
  });
});

describe('monthPeakWarning', () => {
  const months = (label: MonthComparison['label']): MonthComparison[] =>
    Array.from({ length: 12 }, (_, i) => ({ month: i + 1, label: i === 11 ? label : 'normal', priceIndex: 1, maxC: 30, minC: 20, summary: '' }));
  const xmas: CalendarEvent = { name: 'Christmas–New Year peak', start: '2026-12-20', end: '2026-12-31', kind: 'season', priceImpact: 1.8 };
  const fair: CalendarEvent = { name: 'Small fair', start: '2026-12-05', end: '2026-12-05', kind: 'local', priceImpact: 1.1 };

  test('peak month: warns, names the strongest event in the month and the cheaper alternative', () => {
    const w = monthPeakWarning(months('peak'), 12, [fair, xmas], { month: '2027-01', savingPct: 25 });
    expect(w).toEqual({ month: 12, isPeakMonth: true, strongestEvent: xmas, bestAlternative: { month: '2027-01', savingPct: 25 } });
  });

  test('normal month with a big event still warns about the event', () => {
    const w = monthPeakWarning(months('normal'), 12, [xmas], null);
    expect(w).toMatchObject({ isPeakMonth: false, strongestEvent: xmas });
  });

  test('nothing notable → no warning', () => {
    expect(monthPeakWarning(months('normal'), 12, [fair], null)).toBeNull();
  });
});

describe('estimateLocalPerDay', () => {
  test('per person per day by style; children 4–7 count half, under 4 nothing', () => {
    const per = LOCAL_PER_PERSON_PER_DAY.budget;
    expect(estimateLocalPerDay({ adults: 2, childAges: [3, 6] }, 'budget')).toBe(Math.round(per * 2.5));
    expect(estimateLocalPerDay({ adults: 2, childAges: [10] }, 'comfort')).toBe(LOCAL_PER_PERSON_PER_DAY.comfort * 3);
  });
});

describe('nearbyCheaperMonth', () => {
  // Goa-like index: Oct 0.9, Nov 1.1, Dec 1.4, Jan 1.05, Feb 0.95, monsoon months much cheaper.
  const idx = [1.05, 0.95, 0.85, 0.8, 0.75, 0.6, 0.55, 0.55, 0.65, 0.9, 1.1, 1.4];
  const climate = idx.map((priceIndex, i) => ({ month: i + 1, priceIndex, maxC: 30, minC: 20, summary: '' }));

  test('cheapest month within ±2 that is still ahead (not the far-off monsoon, not a past month)', () => {
    // Today is in Nov 2026: Oct 2026 is past and Nov is under way, so Jan or Feb 2027.
    expect(nearbyCheaperMonth(climate, '2026-12', '2026-11-08')).toEqual({ month: '2027-02', savingPct: 32 });
  });

  test('needs at least a 10% saving', () => {
    const flat = climate.map((c) => ({ ...c, priceIndex: 1 }));
    expect(nearbyCheaperMonth(flat, '2026-12', '2026-11-08')).toBeNull();
  });

  test('stays within the bookable 12 months', () => {
    // Chosen Oct 2027 (11 months ahead): Nov/Dec 2027 are beyond the window; Aug/Sep 2027 qualify.
    expect(nearbyCheaperMonth(climate, '2027-10', '2026-11-08')).toEqual({ month: '2027-08', savingPct: 39 });
  });
});
