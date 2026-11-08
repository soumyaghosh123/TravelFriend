import type { Travellers } from '../types.js';

export type PlanStyle = 'offbeat' | 'budget' | 'comfort';

/**
 * Local transport + food + sights, per person per day, in rupees. A placeholder estimate until
 * destination-specific local-transport, food and sight prices arrive (build steps 7–8); always shown as "approx.".
 */
export const LOCAL_PER_PERSON_PER_DAY: Record<PlanStyle, number> = { offbeat: 900, budget: 700, comfort: 1800 };

/** Group estimate per day: adults and children 8+ count fully, 4–7 half, under 4 nothing (same bands as fares). */
export function estimateLocalPerDay(t: Travellers, style: PlanStyle): number {
  const people = t.adults + t.childAges.reduce((n, a) => n + (a >= 8 ? 1 : a >= 4 ? 0.5 : 0), 0);
  return Math.round(LOCAL_PER_PERSON_PER_DAY[style] * people);
}
