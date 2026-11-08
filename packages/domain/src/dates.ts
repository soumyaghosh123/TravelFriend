import type { ISODate } from './types.js';

const MS_PER_DAY = 86_400_000;

function toUtc(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y!, m! - 1, day!);
}

function fromUtc(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUtc(toUtc(d) + n * MS_PER_DAY);
}

/** Number of days from `a` to `b` (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtc(b) - toUtc(a)) / MS_PER_DAY);
}

export function eachDay(from: ISODate, toInclusive: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= toInclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(d: ISODate): number {
  return new Date(toUtc(d)).getUTCDay();
}

/** True for the night starting on a Friday or Saturday. */
export function isWeekendNight(d: ISODate): boolean {
  const w = dayOfWeek(d);
  return w === 5 || w === 6;
}
