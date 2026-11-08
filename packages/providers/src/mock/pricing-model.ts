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
}

/**
 * Realistic-looking, deterministic price for one date:
 * base × season × weekend × strongest event × ±5% noise.
 */
export function mockDailyPrice(a: MockDailyPriceArgs): number {
  const month = Number(a.date.slice(5, 7));
  const season = a.climate.find((c) => c.month === month)?.priceIndex ?? 1;
  const weekend = isWeekendNight(a.date) ? (a.weekendUplift ?? 1.15) : 1;
  const event = Math.max(1, ...a.events.filter((e) => e.start <= a.date && e.end >= a.date).map((e) => e.priceImpact));
  const noise = 0.95 + 0.1 * draw(`${a.destination}|${a.key}|${a.date}`);
  return Math.round(a.base * season * weekend * event * noise);
}
