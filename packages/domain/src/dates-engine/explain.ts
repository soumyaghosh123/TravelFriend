import { addDays, eachDay, isWeekendNight } from '../dates.js';
import type { CalendarEvent, EventKind, ISODate, MonthClimate } from '../types.js';
import { MONTHS_AHEAD, monthFrom } from '../search/search-input.js';
import type { DateWindow } from './windows.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface WindowReason {
  kind: EventKind | 'weekend';
  /** English text; the UI builds its own translated text from `event` / `nights`. */
  text: string;
  event?: CalendarEvent;
  nights?: number;
}

function day(d: ISODate): number {
  return Number(d.slice(8, 10));
}

function mon(d: ISODate): string {
  return MONTHS[Number(d.slice(5, 7)) - 1]!;
}

/** "19 Dec", "20–31 Dec" or "28 Dec–2 Jan". */
function formatRange(start: ISODate, end: ISODate): string {
  if (start === end) return `${day(start)} ${mon(start)}`;
  if (start.slice(0, 7) === end.slice(0, 7)) return `${day(start)}–${day(end)} ${mon(end)}`;
  return `${day(start)} ${mon(start)}–${day(end)} ${mon(end)}`;
}

/** Why a window costs what it does: price-raising events it overlaps, then weekend nights. */
export function explainWindow(w: DateWindow, events: CalendarEvent[]): WindowReason[] {
  const reasons: WindowReason[] = events
    .filter((e) => e.priceImpact > 1 && e.start <= w.end && e.end >= w.start)
    .sort((a, b) => b.priceImpact - a.priceImpact)
    .map((e) => ({ kind: e.kind, text: `${e.name} (${formatRange(e.start, e.end)})`, event: e }));

  const weekendNights = eachDay(w.start, addDays(w.end, -1)).filter(isWeekendNight).length;
  if (weekendNights >= 2) {
    reasons.push({ kind: 'weekend', text: `Includes ${weekendNights} Friday/Saturday nights`, nights: weekendNights });
  }
  return reasons;
}

export interface MonthComparison {
  month: number;
  label: 'cheap' | 'normal' | 'peak';
  priceIndex: number;
  maxC: number;
  minC: number;
  summary: string;
}

export function compareMonths(
  climate: MonthClimate[],
  chosenMonth: number,
): { months: MonthComparison[]; bestAlternative: { month: number; savingPct: number } | null } {
  const months = climate.map((c) => ({
    month: c.month,
    label: c.priceIndex < 0.85 ? ('cheap' as const) : c.priceIndex > 1.15 ? ('peak' as const) : ('normal' as const),
    priceIndex: c.priceIndex,
    maxC: c.maxC,
    minC: c.minC,
    summary: c.summary,
  }));

  const chosen = climate.find((c) => c.month === chosenMonth);
  const cheapest = climate
    .filter((c) => c.month !== chosenMonth)
    .sort((a, b) => a.priceIndex - b.priceIndex)[0];
  if (!chosen || !cheapest || cheapest.priceIndex > chosen.priceIndex * 0.9) {
    return { months, bestAlternative: null };
  }
  return {
    months,
    bestAlternative: { month: cheapest.month, savingPct: Math.round((1 - cheapest.priceIndex / chosen.priceIndex) * 100) },
  };
}

/** Events at or above this impact are worth a warning even outside a peak month (e.g. +30%). */
export const BIG_EVENT_IMPACT = 1.3;

export interface PeakWarning {
  month: number;
  isPeakMonth: boolean;
  /** The strongest price-raising event in the month, if any. */
  strongestEvent?: CalendarEvent;
  bestAlternative: MonthAlternative | null;
}

/**
 * "December is peak season in Goa: Christmas–New Year prices… Mid-January saves about 25%."
 * Null when the month is not peak and has no big event.
 */
export function monthPeakWarning(
  months: MonthComparison[],
  chosenMonth: number,
  events: CalendarEvent[],
  bestAlternative: MonthAlternative | null,
): PeakWarning | null {
  const isPeakMonth = months.find((m) => m.month === chosenMonth)?.label === 'peak';
  const strongest = events
    .filter((e) => e.priceImpact > 1)
    .sort((a, b) => b.priceImpact - a.priceImpact || (a.start < b.start ? -1 : 1))[0];
  const bigEvent = strongest && strongest.priceImpact >= BIG_EVENT_IMPACT ? strongest : undefined;
  if (!isPeakMonth && !bigEvent) return null;
  return {
    month: chosenMonth,
    isPeakMonth,
    ...(isPeakMonth ? (strongest ? { strongestEvent: strongest } : {}) : { strongestEvent: bigEvent }),
    bestAlternative,
  };
}

/** A month to suggest instead, as `YYYY-MM`. */
export interface MonthAlternative {
  month: string;
  savingPct: number;
}

/**
 * The cheapest month within ±`maxDistance` of the chosen one that can still be booked (after the
 * current month, within the search's 12-month range) and saves at least 10%. Nearby months keep a
 * similar season, so we don't push a beach trip into the monsoon.
 */
export function nearbyCheaperMonth(
  climate: MonthClimate[],
  chosen: string,
  today: ISODate,
  maxDistance = 2,
): MonthAlternative | null {
  const indexOf = (ym: string) => climate.find((c) => c.month === Number(ym.slice(5, 7)))?.priceIndex;
  const chosenIdx = indexOf(chosen);
  if (chosenIdx === undefined) return null;
  const current = today.slice(0, 7);
  const last = monthFrom(today, MONTHS_AHEAD - 1);
  let best: MonthAlternative | null = null;
  for (let d = -maxDistance; d <= maxDistance; d++) {
    if (d === 0) continue;
    const ym = monthFrom(`${chosen}-01`, d);
    if (ym <= current || ym > last) continue;
    const idx = indexOf(ym);
    if (idx === undefined) continue;
    const savingPct = Math.round((1 - idx / chosenIdx) * 100);
    if (savingPct >= 10 && (!best || savingPct > best.savingPct)) best = { month: ym, savingPct };
  }
  return best;
}
