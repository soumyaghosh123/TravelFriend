import {
  compareMonths,
  computeWindows,
  estimateLocalPerDay,
  explainWindow,
  monthPeakWarning,
  nearbyCheaperMonth,
  topWindows,
  type CalendarEvent,
  type DateWindow,
  type ISODate,
  type ValidSearchInput,
} from '@tripsaver/domain';
import { buildCheapestDatesInput, priceWindow, type CheapestDatesArgs, type TripStyle } from './assemble.js';
import type { Clock } from './clock.js';
import type { ProviderSet } from './interfaces.js';
import type { DatesSection, StyleDates, WindowDetail } from './results-contract.js';

/** Plan styles with a price calendar, in display order (brief §2.3). */
export const DATE_STYLES: TripStyle[] = ['offbeat', 'budget', 'comfort'];

/** Rejects if `p` takes longer than `ms` (PLAN §7: per-provider timeouts). */
export function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

export interface DatesOptions {
  /** Today's local date, so the suggested month is still bookable. */
  today: ISODate;
  clock: Clock;
  timeoutMs: number;
}

/** The windows behind one style's calendar, kept so a clicked date can be re-priced cheaply. */
export interface ComputedWindows {
  args: CheapestDatesArgs;
  windows: DateWindow[];
  events: CalendarEvent[];
}

export function datesArgs(input: ValidSearchInput, style: TripStyle): CheapestDatesArgs {
  const [year, month] = input.month.split('-').map(Number) as [number, number];
  return {
    from: input.from,
    to: input.to,
    year,
    month,
    days: input.days,
    travellers: input.travellers,
    style,
    localPerDay: estimateLocalPerDay(input.travellers, style),
    ...(input.preferences?.stayNear ? { stayNear: input.preferences.stayNear } : {}),
  };
}

/** Calendar events and climate are nice-to-have: if they fail, dates still render without reasons. */
async function optional<T>(p: Promise<T> | undefined, fallback: T, ms: number, what: string): Promise<T> {
  if (!p) return fallback;
  try {
    return await withTimeout(p, ms, what);
  } catch {
    return fallback;
  }
}

export async function monthEvents(set: ProviderSet, input: ValidSearchInput, ms: number): Promise<CalendarEvent[]> {
  const [year, month] = input.month.split('-').map(Number) as [number, number];
  return optional(set.calendar[0]?.events(input.to, year, month), [], ms, 'calendar');
}

/** Price grids → every window for one style. */
export async function loadWindows(
  set: ProviderSet,
  input: ValidSearchInput,
  style: TripStyle,
  events: CalendarEvent[],
  ms: number,
): Promise<ComputedWindows> {
  const args = datesArgs(input, style);
  const grids = await withTimeout(buildCheapestDatesInput(set, args), ms, `${style} price grids`);
  return { args, windows: computeWindows(grids), events };
}

async function styleDates(set: ProviderSet, c: ComputedWindows, opts: DatesOptions): Promise<StyleDates> {
  const { args, windows, events } = c;
  const fetchedAt = opts.clock().toISOString();
  const feasible = windows.filter((w) => w.feasible);
  const worst = feasible.reduce<DateWindow | undefined>((a, b) => (!a || b.total > a.total ? b : a), undefined);
  const ranked = topWindows(windows);
  const price = (w: DateWindow) => withTimeout(priceWindow(set, args, w), opts.timeoutMs, 'window pricing');
  const [pricedTop, pricedWorst] = await Promise.all([Promise.all(ranked.map(price)), worst ? price(worst) : Promise.resolve(null)]);

  const sources = new Set<string>();
  for (const w of feasible) {
    if (w.legs) {
      sources.add(w.legs.onward.source);
      sources.add(w.legs.return.source);
    }
  }
  for (const h of set.hotel) sources.add(h.name);

  return {
    style: args.style,
    cells: windows.map((w) => ({ start: w.start, end: w.end, feasible: w.feasible, total: w.total, band: w.band })),
    top: pricedTop.map((p, i) => ({
      ...p,
      rank: i + 1,
      saving: pricedWorst ? Math.max(0, pricedWorst.total - p.total) : 0,
      reasons: explainWindow(ranked[i]!, events),
    })),
    mostExpensive: pricedWorst && worst ? { ...pricedWorst, reasons: explainWindow(worst, events) } : null,
    localPerDay: args.localPerDay,
    sources: [...sources],
    fetchedAt,
  };
}

/**
 * The whole "Best dates & price calendar" section (PLAN §6.2): calendar cells and the 3 cheapest
 * windows per style, priced with bookable offers, plus reasons, month comparison and booking advice.
 * `onWindows` receives each style's computed windows (for caching by the caller).
 */
export async function buildDatesSection(
  set: ProviderSet,
  input: ValidSearchInput,
  opts: DatesOptions,
  onWindows?: (style: TripStyle, c: ComputedWindows) => void,
): Promise<DatesSection> {
  const [year, month] = input.month.split('-').map(Number) as [number, number];
  const [events, climate] = await Promise.all([
    monthEvents(set, input, opts.timeoutMs),
    optional(set.weather[0]?.climate(input.to), [], opts.timeoutMs, 'climate'),
  ]);
  const styles = await Promise.all(
    DATE_STYLES.map(async (style) => {
      const c = await loadWindows(set, input, style, events, opts.timeoutMs);
      onWindows?.(style, c);
      return styleDates(set, c, opts);
    }),
  );
  const { months } = compareMonths(climate, month);
  const bestAlternative = nearbyCheaperMonth(climate, input.month, opts.today);
  return {
    year,
    month,
    days: input.days,
    styles,
    events,
    months,
    bestAlternative,
    peakWarning: monthPeakWarning(months, month, events, bestAlternative),
    climate: climate.find((c) => c.month === month) ?? null,
    bookingAdvice: set.train[0]?.bookingWindow() ?? null,
  };
}

/** Re-prices one start date from already computed windows. `null` when no trip can start that day. */
export async function windowDetail(set: ProviderSet, c: ComputedWindows, start: ISODate, ms: number): Promise<WindowDetail | null> {
  const w = c.windows.find((x) => x.start === start);
  if (!w?.feasible) return null;
  const priced = await withTimeout(priceWindow(set, c.args, w), ms, 'window pricing');
  return { window: priced, estimate: w.total, reasons: explainWindow(w, c.events) };
}
