import { addDays, eachDay, isWeekendNight } from '../dates.js';
import type { CalendarEvent, EventKind, ISODate, MonthClimate } from '../types.js';
import type { DateWindow } from './windows.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface WindowReason {
  kind: EventKind | 'weekend';
  text: string;
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
    .map((e) => ({ kind: e.kind, text: `${e.name} (${formatRange(e.start, e.end)})` }));

  const weekendNights = eachDay(w.start, addDays(w.end, -1)).filter(isWeekendNight).length;
  if (weekendNights >= 2) reasons.push({ kind: 'weekend', text: `Includes ${weekendNights} Friday/Saturday nights` });
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
