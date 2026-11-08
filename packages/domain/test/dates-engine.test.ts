import { describe, expect, test } from 'vitest';
import { computeWindows, type CheapestDatesInput, type LegOption } from '../src/dates-engine/windows.js';
import { topWindows } from '../src/dates-engine/top.js';
import { addDays, daysInMonth, diffDays, eachDay, isoDate } from '../src/dates.js';
import type { ISODate } from '../src/types.js';

function grid<T>(year: number, month: number, f: (d: ISODate) => T): Record<ISODate, T> {
  const out: Record<ISODate, T> = {};
  for (const d of eachDay(isoDate(year, month, 1), isoDate(year, month, daysInMonth(year, month)))) out[d] = f(d);
  return out;
}

function flatInput(overrides: Partial<CheapestDatesInput> = {}): CheapestDatesInput {
  const year = overrides.year ?? 2026;
  const month = overrides.month ?? 12;
  const leg = (d: ISODate): LegOption => ({ departDate: d, arriveDate: d, groupFare: 1000, source: 'test' });
  return {
    year,
    month,
    days: 10,
    onwardByDate: grid(year, month, leg),
    returnByDate: grid(year, month, leg),
    nightlyGroupPrice: grid(year, month, () => 500),
    localPerDay: 100,
    ...overrides,
  };
}

describe('computeWindows', () => {
  test('one window per start date that fits in the month', () => {
    const ws = computeWindows(flatInput());
    expect(ws).toHaveLength(22);
    expect(ws[0]!.start).toBe('2026-12-01');
    expect(ws[0]!.end).toBe('2026-12-10');
    expect(ws.at(-1)!.start).toBe('2026-12-22');
    expect(ws.at(-1)!.end).toBe('2026-12-31');
  });

  test('flat prices: 9 hotel nights, total adds up, all in the cheapest band', () => {
    for (const w of computeWindows(flatInput())) {
      expect(w.feasible).toBe(true);
      expect(w.hotelNights).toBe(9);
      expect(w.daysAtDestination).toBe(10);
      expect(w.breakdown).toEqual({ onward: 1000, return: 1000, hotel: 4500, local: 1000 });
      expect(w.total).toBe(7500);
      expect(w.band).toBe(1);
    }
  });

  test('overnight trains: hotel nights count only nights at the destination', () => {
    const slow = (d: ISODate): LegOption => ({ departDate: d, arriveDate: addDays(d, 1), groupFare: 1000, source: 't' });
    const ws = computeWindows(flatInput({ onwardByDate: grid(2026, 12, slow), returnByDate: grid(2026, 12, slow) }));
    const w = ws[0]!;
    expect(w.hotelNights).toBe(7); // arrive 2 Dec, leave 9 Dec, home 10 Dec
    expect(w.daysAtDestination).toBe(8);
    expect(w.breakdown.hotel).toBe(3500);
    expect(w.breakdown.local).toBe(800);
  });

  test('a start date with no onward service is infeasible, never ₹0 and never top-ranked', () => {
    const input = flatInput();
    delete input.onwardByDate['2026-12-05'];
    const ws = computeWindows(input);
    const w5 = ws.find((w) => w.start === '2026-12-05')!;
    expect(w5.feasible).toBe(false);
    expect(w5.band).toBeNull();
    expect(topWindows(ws, 30, 0).map((w) => w.start)).not.toContain('2026-12-05');
  });

  test('a missing hotel night makes the window infeasible', () => {
    const input = flatInput();
    delete input.nightlyGroupPrice['2026-12-03'];
    const ws = computeWindows(input);
    expect(ws[0]!.feasible).toBe(false);
    expect(ws.find((w) => w.start === '2026-12-04')!.feasible).toBe(true);
  });

  test('prices rise into the peak: bands go from 1 to 5', () => {
    const input = flatInput({
      nightlyGroupPrice: grid(2026, 12, (d) => (d >= '2026-12-20' ? 2000 : 500)),
    });
    const ws = computeWindows(input);
    expect(ws[0]!.band).toBe(1);
    expect(ws.at(-1)!.band).toBe(5);
  });

  test.each([
    [{ days: 1 }],
    [{ days: 29, month: 2, year: 2026 }],
    [{ month: 13 }],
  ])('rejects impossible trips %j with RangeError', (o) => {
    expect(() => computeWindows(flatInput(o as Partial<CheapestDatesInput>))).toThrow(RangeError);
  });
});

describe('topWindows', () => {
  test('peak: 3 windows, ≥ 3 days apart, cheapest first, saving vs most expensive', () => {
    const ws = computeWindows(
      flatInput({ nightlyGroupPrice: grid(2026, 12, (d) => (d >= '2026-12-20' ? 2000 : 500)) }),
    );
    const top = topWindows(ws);
    expect(top).toHaveLength(3);
    expect(top[0]!.start).toBe('2026-12-01');
    expect(top.map((t) => t.rank)).toEqual([1, 2, 3]);
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++)
        expect(Math.abs(diffDays(top[i]!.start, top[j]!.start))).toBeGreaterThanOrEqual(3);
    const maxTotal = Math.max(...ws.map((w) => w.total));
    expect(top[0]!.savingVsMostExpensive).toBe(maxTotal - top[0]!.total);
    expect(top[0]!.savingVsMostExpensive).toBeGreaterThan(0);
  });

  test('ties: earlier start wins, then the gap rule skips neighbours', () => {
    expect(topWindows(computeWindows(flatInput())).map((t) => t.start)).toEqual([
      '2026-12-01',
      '2026-12-04',
      '2026-12-07',
    ]);
  });

  test('fewer windows than requested: no duplicates, no padding', () => {
    const top = topWindows(computeWindows(flatInput({ days: 30 })));
    expect(top.length).toBeLessThanOrEqual(2);
    expect(new Set(top.map((t) => t.start)).size).toBe(top.length);
  });
});
