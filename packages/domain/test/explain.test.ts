import { describe, expect, test } from 'vitest';
import { compareMonths, explainWindow } from '../src/dates-engine/explain.js';
import type { DateWindow } from '../src/dates-engine/windows.js';
import type { CalendarEvent, MonthClimate } from '../src/types.js';

const win = (start: string, end: string): DateWindow => ({
  start,
  end,
  feasible: true,
  total: 1,
  hotelNights: 1,
  daysAtDestination: 2,
  breakdown: { onward: 0, return: 0, hotel: 0, local: 0 },
  band: 1,
});

const xmas: CalendarEvent = {
  name: 'Christmas–New Year peak',
  start: '2026-12-20',
  end: '2026-12-31',
  kind: 'season',
  priceImpact: 1.8,
};
const liberation: CalendarEvent = {
  name: 'Goa Liberation Day',
  start: '2026-12-19',
  end: '2026-12-19',
  kind: 'holiday',
  priceImpact: 1.2,
};
const neutral: CalendarEvent = { name: 'Quiet fair', start: '2026-12-01', end: '2026-12-31', kind: 'local', priceImpact: 1 };

describe('explainWindow', () => {
  test('overlapping price-raising events, strongest first, with readable dates', () => {
    const reasons = explainWindow(win('2026-12-19', '2026-12-28'), [liberation, xmas, neutral]);
    expect(reasons[0]).toEqual({ kind: 'season', text: 'Christmas–New Year peak (20–31 Dec)' });
    expect(reasons[1]).toEqual({ kind: 'holiday', text: 'Goa Liberation Day (19 Dec)' });
  });

  test('events outside the window and neutral events are not reasons', () => {
    const reasons = explainWindow(win('2026-12-01', '2026-12-10'), [xmas, neutral]);
    expect(reasons.find((r) => r.kind === 'season')).toBeUndefined();
    expect(reasons.find((r) => r.kind === 'local')).toBeUndefined();
  });

  test('counts Friday/Saturday nights inside the window', () => {
    expect(explainWindow(win('2026-12-01', '2026-12-10'), [])).toContainEqual({
      kind: 'weekend',
      text: 'Includes 2 Friday/Saturday nights',
    });
    expect(explainWindow(win('2026-12-06', '2026-12-07'), [])).toEqual([]);
  });
});

describe('compareMonths', () => {
  const climate = (overrides: Record<number, number>): MonthClimate[] =>
    Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      priceIndex: overrides[i + 1] ?? 1.3,
      maxC: 30,
      minC: 20,
      summary: 'ok',
    }));

  test('labels months and finds a much cheaper alternative', () => {
    const r = compareMonths(climate({ 12: 1.4, 1: 1.05 }), 12);
    expect(r.months[11]!.label).toBe('peak');
    expect(r.months[0]!.label).toBe('normal');
    expect(r.bestAlternative).toEqual({ month: 1, savingPct: 25 });
  });

  test('cheap label below 0.85', () => {
    expect(compareMonths(climate({ 7: 0.6 }), 12).months[6]!.label).toBe('cheap');
  });

  test('no alternative when nothing is at least 10% cheaper', () => {
    const flat = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, priceIndex: 1, maxC: 1, minC: 1, summary: '' }));
    flat[2]!.priceIndex = 0.95;
    expect(compareMonths(flat, 12).bestAlternative).toBeNull();
  });
});
