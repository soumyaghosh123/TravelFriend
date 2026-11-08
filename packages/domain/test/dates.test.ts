import { describe, expect, test } from 'vitest';
import { addDays, dayOfWeek, daysInMonth, diffDays, eachDay, isoDate, isWeekendNight } from '../src/dates.js';

describe('dates', () => {
  test('daysInMonth handles 31-day months, February and leap years', () => {
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
  });

  test('isoDate zero-pads', () => {
    expect(isoDate(2026, 1, 5)).toBe('2026-01-05');
  });

  test('addDays crosses year and leap-day boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-10', -9)).toBe('2026-12-01');
  });

  test('diffDays counts b minus a', () => {
    expect(diffDays('2026-12-01', '2026-12-10')).toBe(9);
  });

  test('eachDay is inclusive', () => {
    expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  });

  test('dayOfWeek: 1 Dec 2026 is a Tuesday', () => {
    expect(dayOfWeek('2026-12-01')).toBe(2);
  });

  test('isWeekendNight is true for Friday and Saturday nights only', () => {
    expect(isWeekendNight('2026-12-04')).toBe(true);
    expect(isWeekendNight('2026-12-05')).toBe(true);
    expect(isWeekendNight('2026-12-06')).toBe(false);
  });
});
