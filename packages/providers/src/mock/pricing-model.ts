import { isWeekendNight, type CalendarEvent, type ISODate, type MonthClimate } from '@tripsaver/domain';
import { draw } from './rng.js';

export interface MockDailyPriceArgs {
  base: number;
  date: ISODate;
  destination: string;
  key: string;
  events: CalendarEvent[];
  climate: MonthClimate[];
  weekendUplift?: number;
  /** The day prices are checked (India date). Mock prices drift a little from day to day. */
  today: ISODate;
}

/** base × season × weekend × strongest event × ±5% noise, before the daily drift (not rounded). */
export function mockDailyPriceBase(a: MockDailyPriceArgs): number {
  const month = Number(a.date.slice(5, 7));
  const season = a.climate.find((c) => c.month === month)?.priceIndex ?? 1;
  const weekend = isWeekendNight(a.date) ? (a.weekendUplift ?? 1.15) : 1;
  const event = Math.max(
    1,
    ...a.events.filter((e) => e.start <= a.date && e.end >= a.date).map((e) => e.priceImpact),
  );
  const noise = 0.95 + 0.1 * draw(`${a.destination}|${a.key}|${a.date}`);
  return a.base * season * weekend * event * noise;
}

/**
 * Realistic-looking, deterministic price for one date, as checked on `today`. A ±4% daily drift
 * stands in for real price movement, so price alerts can fire on sample data (decision 2026-11-10).
 */
export function mockDailyPrice(a: MockDailyPriceArgs): number {
  const drift = 0.96 + 0.08 * draw(`${a.destination}|${a.key}|${a.date}|${a.today}`);
  return Math.round(mockDailyPriceBase(a) * drift);
}
