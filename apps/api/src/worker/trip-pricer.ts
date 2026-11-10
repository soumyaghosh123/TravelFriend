import { makeSearchInputSchema } from '@tripsaver/domain';
import type { ProviderSet, TripStyle } from '@tripsaver/providers';
import type { SavedTrip } from '../account/account-store.js';
import type { CostService } from '../results/cost.service.js';
import type { DatesService } from '../results/dates.service.js';
import { todayInIndia } from '../search/search.controller.js';

/**
 * A saved trip priced today.
 * - `stale`: its inputs no longer validate (the month has passed).
 * - `unavailable`: no trip can start on the saved date any more.
 */
export type PricedTrip =
  | {
      kind: 'ok';
      /** Group total and per person, integer rupees. */
      total: number;
      perPerson: number;
      start: string;
      end: string;
      destination: string;
    }
  | { kind: 'stale' }
  | { kind: 'unavailable' };

export interface TripPricer {
  price(trip: SavedTrip, now: Date): Promise<PricedTrip>;
}

/** Prices a saved trip the way the results page does: its window, then the "Total & book" cost. */
export class LiveTripPricer implements TripPricer {
  constructor(
    private readonly dates: DatesService,
    private readonly cost: CostService,
    private readonly providers: ProviderSet,
  ) {}

  async price(trip: SavedTrip, now: Date): Promise<PricedTrip> {
    const today = todayInIndia(now);
    const parsed = makeSearchInputSchema(today).safeParse(trip.inputs);
    if (!parsed.success) return { kind: 'stale' };
    const style = trip.style as TripStyle;
    // A fresh cache key each day, so today's prices are used (DatesService caches windows by key).
    const detail = await this.dates.window(`alert:${trip.id}:${today}`, parsed.data, style, trip.start);
    if (!detail) return { kind: 'unavailable' };
    const view = await this.cost.plan(parsed.data, style, detail.window);
    if (!view.available) return { kind: 'unavailable' };
    return {
      kind: 'ok',
      total: view.cost.total,
      perPerson: view.cost.perPerson,
      start: view.start,
      end: view.end,
      destination: this.providers.places.get(parsed.data.to)?.name ?? parsed.data.to,
    };
  }
}
