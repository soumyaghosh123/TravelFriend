import {
  groupEntryFee,
  planCost,
  sumDaySpends,
  type PlanCost,
  type ValidSearchInput,
} from '@tripsaver/domain';
import type { PricedWindow, TripStyle } from './assemble.js';
import type { Clock } from './clock.js';
import { buildHotelsSection } from './hotels-section.js';
import { buildItinerarySection } from './itinerary-section.js';
import type { ProviderSet } from './interfaces.js';
import type { ChecklistItem, HotelsSection, ItinerarySection, PlanCostView } from './results-contract.js';

type Opts = { clock: Clock; timeoutMs: number };
type Plan = Extract<ItinerarySection, { available: true }>;

/** Hotels for a window's stay, as the Hotels tab shows them. */
export function hotelsForWindow(
  set: ProviderSet,
  input: ValidSearchInput,
  w: PricedWindow,
  opts: Opts,
): Promise<HotelsSection> {
  return buildHotelsSection(
    set,
    {
      to: input.to,
      checkIn: w.onward.arriveDate,
      checkOut: w.return.departDate,
      travellers: input.travellers,
      ...(input.preferences?.stayNear ? { stayNear: input.preferences.stayNear } : {}),
    },
    opts,
  );
}

function checklist(w: PricedWindow, plan: Plan, t: ValidSearchInput['travellers']): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'onward', kind: 'transport', direction: 'onward', offer: w.onward, amount: w.onward.price.amount },
  ];
  for (const b of plan.bases) {
    if (!b.hotel || b.hotelTotal === null) continue;
    items.push({
      id: `hotel-${b.id}`,
      kind: 'hotel',
      baseName: b.name,
      hotelName: b.hotel.name,
      checkIn: b.checkIn,
      nights: b.nights,
      rooms: b.hotel.rooms,
      offer: b.hotel.cheapest,
      amount: b.hotelTotal,
      isEstimate: b.hotelTotalIsEstimate,
    });
  }
  const dateOf = new Map(plan.days.map((d) => [d.index, d.date]));
  for (const d of plan.days) {
    for (const s of d.stops) {
      const a = s.attractionId ? plan.attractions[s.attractionId] : undefined;
      if (!a || a.entryFee === 0) continue;
      items.push({
        id: `ticket-${a.id}-${d.index}`,
        kind: 'ticket',
        name: a.name,
        date: d.date,
        amount: groupEntryFee(a.entryFee, t),
        ...(a.ticketUrl ? { ticketUrl: a.ticketUrl } : {}),
      });
    }
  }
  for (const l of plan.local.legs) {
    for (const e of l.extras) {
      // Midpoint, as in the day's spend.
      items.push({
        id: `extra-${e.id}-${l.dayIndex}`,
        kind: 'local-extra',
        name: e.name,
        date: dateOf.get(l.dayIndex) ?? w.start,
        amount: Math.round((e.min + e.max) / 2),
        booking: e.booking,
      });
    }
  }
  items.push({
    id: 'return',
    kind: 'transport',
    direction: 'return',
    offer: w.return,
    amount: w.return.price.amount,
  });
  return items;
}

/** The plan with the 5★ option at every base; null when a base has no 5★ hotel. */
function fiveStarCost(
  plan: Plan,
  lines: Omit<PlanCost, 'buffer' | 'total' | 'people' | 'perPerson'>,
  input: ValidSearchInput,
): PlanCost | null {
  if (plan.bases.some((b) => !b.fiveStar)) return null;
  const single = plan.bases.length === 1;
  const hotels = plan.bases.reduce(
    (s, b) => s + (single ? b.fiveStar!.totalPrice : b.fiveStar!.perNight * b.nights),
    0,
  );
  return planCost({ ...lines, hotels }, 'comfort', input.travellers);
}

/**
 * Total trip cost for one plan and window (PLAN §6.7). Every row comes from another tab, so they agree:
 * transport = the plan's legs (Getting there), hotels = the plan's hotel at each base (Day-by-day /
 * Hotels), local, sights and food = the sum of each day's spend (Day-by-day), plus a shopping buffer.
 */
export async function buildPlanCost(
  set: ProviderSet,
  input: ValidSearchInput,
  style: TripStyle,
  w: PricedWindow,
  opts: Opts,
  hotels?: HotelsSection | null,
): Promise<PlanCostView> {
  const stay = hotels !== undefined ? hotels : await hotelsForWindow(set, input, w, opts).catch(() => null);
  const plan = await buildItinerarySection(set, input, style, w, stay, opts);
  if (!plan.available) return { style, available: false };
  const days = sumDaySpends(plan.days);
  const lines = {
    transport: w.onward.price.amount + w.return.price.amount,
    hotels: plan.bases.reduce((s, b) => s + (b.hotelTotal ?? 0), 0),
    ...days,
  };
  const cost = planCost(lines, style, input.travellers);
  const items = checklist(w, plan, input.travellers);
  const sources = [
    ...new Set([
      w.onward.sourceName,
      w.return.sourceName,
      ...plan.bases.flatMap((b) => (b.hotel ? [b.hotel.cheapest.sourceName] : [])),
    ]),
  ];
  return {
    style,
    available: true,
    start: w.start,
    end: w.end,
    cost,
    fiveStar: style === 'comfort' ? fiveStarCost(plan, lines, input) : null,
    checklist: items,
    sources,
    sampleData: plan.sampleData,
    fetchedAt: opts.clock().toISOString(),
  };
}
