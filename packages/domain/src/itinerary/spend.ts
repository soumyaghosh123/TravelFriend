import type { PlanStyle } from '../dates-engine/local-estimate.js';
import { DEFAULT_PRICING_RULES, fareTypeForAge } from '../pricing/rules.js';
import type { Travellers } from '../types.js';
import type { AttractionLike, ItineraryDay } from './types.js';

/**
 * Placeholder rates until local-transport and food data arrive (build steps 7–8); always shown as approx.
 * Local travel is per km for the whole group (budget: buses and scooters; comfort: a cab).
 */
export const LOCAL_RATE_PER_KM: Record<PlanStyle, number> = { offbeat: 14, budget: 12, comfort: 24 };
export const MEALS_PER_PERSON_PER_DAY: Record<PlanStyle, number> = { offbeat: 450, budget: 400, comfort: 1200 };
/** On a travel day you eat on board or at the station: about half a normal day. */
const TRAVEL_DAY_MEALS = 0.5;

/** Entry fee for the group using the default age bands (under 4 free, 4–7 half, 8+ full); an estimate. */
export function groupEntryFee(adultFee: number, t: Travellers): number {
  const children = t.childAges.reduce((s, age) => s + Math.round(adultFee * fareTypeForAge(age, 'bus', '', DEFAULT_PRICING_RULES).multiplier), 0);
  return adultFee * t.adults + children;
}

/** People counted for meals: adults and children 8+ fully, 4–7 half, under 4 not at all. */
function eaters(t: Travellers): number {
  return t.adults + t.childAges.reduce((s, a) => s + (a >= 8 ? 1 : a >= 4 ? 0.5 : 0), 0);
}

export interface DaySpend {
  entry: number;
  local: number;
  meals: number;
  total: number;
}

/** A day's estimated spend for the group: entry fees + local travel + meals (brief §3.5 "the day's estimated spend"). */
export function daySpend(day: ItineraryDay, byId: Map<string, AttractionLike>, t: Travellers, style: PlanStyle): DaySpend {
  const entry = day.stops.reduce((s, x) => s + (x.attractionId ? groupEntryFee(byId.get(x.attractionId)?.entryFee ?? 0, t) : 0), 0);
  const km = day.stops.reduce((s, x) => s + (x.distanceKm ?? 0), 0);
  const local = Math.round(km * LOCAL_RATE_PER_KM[style]);
  const share = day.kind === 'travel' ? TRAVEL_DAY_MEALS : 1;
  const meals = Math.round(eaters(t) * MEALS_PER_PERSON_PER_DAY[style] * share);
  return { entry, local, meals, total: entry + local + meals };
}
