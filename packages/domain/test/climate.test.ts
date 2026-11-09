import { describe, expect, test } from 'vitest';
import { climateNormals, climateSummary } from '../src/climate/climate.js';

describe('climateNormals: monthly averages from daily observations', () => {
  test('mean daily max/min, mean monthly rain and rainy days (≥ 1 mm) across years', () => {
    const days = [
      // Dec 2023: 2 days, one rainy
      { date: '2023-12-01', maxC: 31, minC: 21, rainMm: 0 },
      { date: '2023-12-02', maxC: 33, minC: 23, rainMm: 4 },
      // Dec 2024: 2 days, dry
      { date: '2024-12-01', maxC: 32, minC: 20, rainMm: 0.5 },
      { date: '2024-12-02', maxC: 32, minC: 22, rainMm: 0 },
      // Jul 2024: 1 day
      { date: '2024-07-15', maxC: 28, minC: 24, rainMm: 60 },
    ];
    const n = climateNormals(days);
    expect(n.map((m) => m.month)).toEqual([7, 12]);
    const dec = n.find((m) => m.month === 12)!;
    expect(dec.maxC).toBe(32);
    expect(dec.minC).toBe(21.5);
    // Rain per month-of-a-year, averaged over the years present: Dec 2023 = 4 mm, Dec 2024 = 0.5 mm.
    expect(dec.rainMm).toBe(2.3);
    // Rainy days per month-of-a-year, averaged: 1 and 0.
    expect(dec.rainyDays).toBe(0.5);
    expect(n.find((m) => m.month === 7)!.rainyDays).toBe(1);
  });

  test('missing values are skipped; empty input → no months', () => {
    expect(climateNormals([])).toEqual([]);
    const n = climateNormals([
      { date: '2024-01-01', maxC: null, minC: 10, rainMm: null },
      { date: '2024-01-02', maxC: 20, minC: 12, rainMm: 0 },
    ]);
    expect(n[0]).toMatchObject({ month: 1, maxC: 20, minC: 11 });
  });
});

describe('climateSummary (shown on the banner and in "What to pack")', () => {
  test('rain and temperature in plain words', () => {
    expect(climateSummary({ maxC: 32, minC: 21, rainMm: 5, rainyDays: 0.4 })).toBe('Warm, mostly dry');
    expect(climateSummary({ maxC: 29, minC: 24, rainMm: 900, rainyDays: 26 })).toBe(
      'Warm, monsoon: rain on most days',
    );
    expect(climateSummary({ maxC: 34, minC: 25, rainMm: 60, rainyDays: 5 })).toBe('Hot, some rainy days');
    expect(climateSummary({ maxC: 10, minC: -2, rainMm: 40, rainyDays: 4 })).toBe(
      'Cold, freezing nights, some rainy days',
    );
    expect(climateSummary({ maxC: 22, minC: 8, rainMm: 120, rainyDays: 9 })).toBe(
      'Mild, cold nights, frequent showers',
    );
  });
});
