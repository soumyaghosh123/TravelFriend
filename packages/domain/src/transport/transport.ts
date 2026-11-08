import { minutesBetween } from '../dates.js';

/** What the transport engines need from an offer. Local date-times are `YYYY-MM-DDTHH:MM`. */
export interface TransportLike {
  mode: 'train' | 'bus' | 'flight';
  travelClass: string;
  groupFare: number;
  departAt: string;
  arriveAt: string;
  durationMin: number;
}

/** Classes you can sleep in, most comfortable first. */
const SLEEPER_COMFORT = ['1A', '2A', '3A', 'AC Sleeper', 'SL', 'Sleeper'];

/** A sleeper-class journey that runs through at least one night (arrives on a later day). */
export function isOvernight(t: TransportLike): boolean {
  if (!SLEEPER_COMFORT.includes(t.travelClass)) return false;
  return t.arriveAt.slice(0, 10) > t.departAt.slice(0, 10);
}

export interface TransportSummary<T> {
  cheapest?: T;
  fastest?: T;
  overnight?: T;
}

function minBy<T>(list: T[], ...keys: ((t: T) => number)[]): T | undefined {
  return [...list].sort((a, b) => {
    for (const k of keys) {
      const d = k(a) - k(b);
      if (d !== 0) return d;
    }
    return 0;
  })[0];
}

/**
 * The three summary cards (mockup "Getting there"): cheapest; fastest (cheaper wins ties);
 * best overnight = the most comfortable sleeper class that travels through the night, cheapest within it.
 */
export function summarizeTransport<T extends TransportLike>(offers: T[]): TransportSummary<T> {
  const out: TransportSummary<T> = {};
  const cheapest = minBy(offers, (t) => t.groupFare, (t) => t.durationMin);
  const fastest = minBy(offers, (t) => t.durationMin, (t) => t.groupFare);
  const overnight = minBy(
    offers.filter(isOvernight),
    (t) => SLEEPER_COMFORT.indexOf(t.travelClass),
    (t) => t.groupFare,
  );
  if (cheapest) out.cheapest = cheapest;
  if (fastest) out.fastest = fastest;
  if (overnight) out.overnight = overnight;
  return out;
}

export interface Combination<T> {
  first: T;
  second: T;
  groupFare: number;
  /** First departure to final arrival. */
  durationMin: number;
  waitMin: number;
}

export interface CombineOptions {
  minConnectionMin: number;
  maxWaitMin: number;
  /** Latest acceptable arrival, local `YYYY-MM-DDTHH:MM` (e.g. the last evening of the trip). */
  arriveBy?: string;
  maxDurationMin?: number;
}

/** Every first-leg × second-leg pair with a workable connection, cheapest first (then fastest). */
export function combineLegs<T extends TransportLike>(firsts: T[], seconds: T[], opts: CombineOptions): Combination<T>[] {
  const out: Combination<T>[] = [];
  for (const a of firsts) {
    for (const b of seconds) {
      const waitMin = minutesBetween(a.arriveAt, b.departAt);
      if (waitMin < opts.minConnectionMin || waitMin > opts.maxWaitMin) continue;
      if (opts.arriveBy && b.arriveAt > opts.arriveBy) continue;
      const durationMin = minutesBetween(a.departAt, b.arriveAt);
      if (opts.maxDurationMin !== undefined && durationMin > opts.maxDurationMin) continue;
      out.push({ first: a, second: b, groupFare: a.groupFare + b.groupFare, durationMin, waitMin });
    }
  }
  return out.sort((x, y) => x.groupFare - y.groupFare || x.durationMin - y.durationMin);
}

/** Keeps combinations that no direct option matches or beats on both price and time. */
export function worthShowing<C extends { groupFare: number; durationMin: number }>(combos: C[], directs: TransportLike[]): C[] {
  return combos.filter((c) => !directs.some((d) => d.groupFare <= c.groupFare && d.durationMin <= c.durationMin));
}
