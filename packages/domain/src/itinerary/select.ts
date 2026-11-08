import type { PlanStyle } from '../dates-engine/local-estimate.js';
import { distanceKm, type LatLng } from '../hotels/hotels.js';
import type { AttractionLike, ItineraryLimits } from './types.js';

/** Budget plans skip paid sights above this (per adult) unless they're must-sees (brief §2.3 B). */
export const BUDGET_MAX_FEE = 500;
/** Offbeat spots: rated at least this, with low footfall (brief §2.3 A). */
export const OFFBEAT_MIN_RATING = 4;

/** Per-style day shape (PLAN §6.3): comfort has fewer stops and a later start. */
export const STYLE_LIMITS: Record<PlanStyle, Partial<ItineraryLimits>> = {
  offbeat: { maxStops: 3 },
  budget: { maxStops: 4 },
  comfort: { maxStops: 3, dayStart: '09:30' },
};

export type PlanSelection =
  | { available: true; attractions: AttractionLike[] }
  | { available: false; reason: 'noOffbeat' };

export function isOffbeatSpot(a: AttractionLike): boolean {
  return a.isOffbeat && a.rating >= OFFBEAT_MIN_RATING && a.footfall === 'low';
}

/**
 * Which sights each plan visits (PLAN §6.3):
 * - Offbeat: offbeat spots + the 1–2 best highlights; if no offbeat spot exists, say so instead of forcing a plan.
 * - Budget: everything free or cheap, plus must-sees whatever they cost.
 * - Comfort: the main (non-offbeat) sights.
 */
export function selectPlanAttractions(style: PlanStyle, all: AttractionLike[]): PlanSelection {
  if (style === 'offbeat') {
    const spots = all.filter(isOffbeatSpot);
    if (spots.length === 0) return { available: false, reason: 'noOffbeat' };
    const highlights = all
      .filter((a) => !a.isOffbeat)
      .sort((a, b) => Number(b.isHighlight) - Number(a.isHighlight) || b.rating - a.rating || (a.id < b.id ? -1 : 1))
      .slice(0, 2);
    return { available: true, attractions: [...spots, ...highlights] };
  }
  if (style === 'budget') return { available: true, attractions: all.filter((a) => a.entryFee <= BUDGET_MAX_FEE || a.isHighlight) };
  return { available: true, attractions: all.filter((a) => !a.isOffbeat) };
}

/** The closest offbeat spot anywhere else, for "no offbeat places here — try …" (brief §2.3 A). */
export function nearestOffbeat<A extends AttractionLike>(from: LatLng, candidates: A[]): (A & { distanceKm: number }) | null {
  const best = candidates
    .filter(isOffbeatSpot)
    .map((a) => ({ ...a, distanceKm: Math.round(distanceKm(from, a)) }))
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];
  return best ?? null;
}
