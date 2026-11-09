import type { PlanStyle } from '../dates-engine/local-estimate.js';
import type { DaySpend } from '../itinerary/spend.js';
import type { Travellers } from '../types.js';

/** Suggested shopping and contingency buffer, as a share of everything else (our suggestion, not a price). */
export const SHOPPING_BUFFER_PCT: Record<PlanStyle, number> = { offbeat: 0.04, budget: 0.03, comfort: 0.03 };

/** The group's cost of a plan by part (PLAN §6.7), integer rupees. */
export interface CostLines {
  /** Onward + return, the plan's chosen legs. */
  transport: number;
  /** All hotel nights, every base. */
  hotels: number;
  /** Local transport, from the day-by-day plan. */
  local: number;
  /** Entry fees and activities. */
  sights: number;
  food: number;
}

export interface PlanCost extends CostLines {
  buffer: number;
  total: number;
  people: number;
  perPerson: number;
}

/** Local travel, sights and food for the whole trip: the sum of each day's spend (so it matches the day plan). */
export function sumDaySpends(days: { spend: DaySpend }[]): Pick<CostLines, 'local' | 'sights' | 'food'> {
  return days.reduce(
    (s, d) => ({
      local: s.local + d.spend.local,
      sights: s.sights + d.spend.entry,
      food: s.food + d.spend.meals,
    }),
    {
      local: 0,
      sights: 0,
      food: 0,
    },
  );
}

/** Total for the group and per person; the rows always add up to the total. */
export function planCost(lines: CostLines, style: PlanStyle, t: Travellers): PlanCost {
  const subtotal = lines.transport + lines.hotels + lines.local + lines.sights + lines.food;
  const buffer = Math.ceil((subtotal * SHOPPING_BUFFER_PCT[style]) / 100) * 100;
  const total = subtotal + buffer;
  const people = t.adults + t.childAges.length;
  return { ...lines, buffer, total, people, perPerson: Math.round(total / Math.max(1, people)) };
}
