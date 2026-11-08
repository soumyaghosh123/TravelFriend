import { addDays } from '../dates.js';
import { distanceKm, type LatLng } from '../hotels/hotels.js';
import type { ISODate } from '../types.js';
import type { AttractionLike, BaseCandidate, BaseStay } from './types.js';

export interface SplitOptions {
  /** Minimum nights at any base (PLAN §6.4). */
  minNights: number;
  /** Roughly how many nights justify one more base. */
  nightsPerBase: number;
  /** Bases closer than this are one area: stay put and do day trips. */
  minApartKm: number;
}

export const DEFAULT_SPLIT: SplitOptions = { minNights: 2, nightsPerBase: 3, minApartKm: 60 };

/** The base each sight is nearest to. */
export function nearestBase<B extends LatLng & { id: string }>(a: LatLng, bases: B[]): B | undefined {
  return [...bases].sort((x, y) => distanceKm(a, x) - distanceKm(a, y) || (x.id < y.id ? -1 : 1))[0];
}

/** Sight minutes available around each candidate (each sight counts for its nearest candidate). */
export function sightMinutes(candidates: BaseCandidate[], attractions: AttractionLike[]): Map<string, number> {
  const out = new Map(candidates.map((c) => [c.id, 0]));
  for (const a of attractions) {
    const b = nearestBase(a, candidates);
    if (b) out.set(b.id, (out.get(b.id) ?? 0) + a.durationMin);
  }
  return out;
}

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

/**
 * BaseSplitter (PLAN §6.4, brief §3.5): which bases, in what order, for how many nights.
 * - More bases only when there are enough nights (≈ `nightsPerBase` each, never under `minNights`).
 * - Candidates are taken by sight-time, skipping any within `minApartKm` of one already chosen.
 * - Nights are proportional to sight-time (largest remainder), at least `minNights` each.
 * - Order minimises arrival → bases → departure distance (exhaustive; candidates ≤ 6).
 */
export function splitBases(
  candidates: BaseCandidate[],
  attractions: AttractionLike[],
  nights: number,
  firstNight: ISODate,
  arrivalPoint: LatLng,
  opts: SplitOptions = DEFAULT_SPLIT,
): BaseStay[] {
  if (nights <= 0 || candidates.length === 0) return [];
  const minutes = sightMinutes(candidates, attractions);
  const ranked = [...candidates].sort((a, b) => (minutes.get(b.id) ?? 0) - (minutes.get(a.id) ?? 0));
  const apart: BaseCandidate[] = [];
  for (const c of ranked) if (apart.every((x) => distanceKm(x, c) >= opts.minApartKm)) apart.push(c);

  const k = Math.max(1, Math.min(apart.length, Math.floor(nights / opts.nightsPerBase), Math.floor(nights / opts.minNights)));
  const chosen = apart.slice(0, k);

  const cost = (order: BaseCandidate[]) =>
    order.reduce((s, b, i) => s + distanceKm(i === 0 ? arrivalPoint : order[i - 1]!, b), 0) + distanceKm(order.at(-1)!, arrivalPoint);
  const order = permutations(chosen).sort((a, b) => cost(a) - cost(b) || a.map((x) => x.id).join() .localeCompare(b.map((x) => x.id).join()))[0]!;

  // Nights: minimum each, the rest by share of sight-time (largest remainder, ties to the earlier base).
  const base = order.map(() => opts.minNights);
  let left = nights - opts.minNights * order.length;
  if (order.length === 1) base[0] = nights;
  else if (left > 0) {
    const weights = order.map((b) => minutes.get(b.id) || 1);
    const total = weights.reduce((s, w) => s + w, 0);
    const exact = weights.map((w) => (w / total) * left);
    exact.forEach((e, i) => (base[i]! += Math.floor(e)));
    left -= exact.reduce((s, e) => s + Math.floor(e), 0);
    const byRemainder = exact.map((e, i) => ({ i, r: e - Math.floor(e) })).sort((a, b) => b.r - a.r || a.i - b.i);
    for (let j = 0; j < left; j++) base[byRemainder[j]!.i]! += 1;
  }

  let night = firstNight;
  return order.map((b, i) => {
    const stay: BaseStay = { ...b, nights: base[i]!, checkIn: night };
    night = addDays(night, base[i]!);
    return stay;
  });
}
