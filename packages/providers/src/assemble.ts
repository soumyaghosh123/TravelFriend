import type { CheapestDatesInput, ISODate, LegOption, Travellers } from '@tripsaver/domain';
import type { HotelType, ProviderSet, TransportOffer, TransportProvider } from './interfaces.js';

export type TripStyle = 'budget' | 'comfort';

export interface CheapestDatesArgs {
  from: string;
  to: string;
  year: number;
  month: number;
  days: number;
  travellers: Travellers;
  style: TripStyle;
  localPerDay: number;
}

/** Which classes and hotel type each style may use (PLAN §6.3). */
const STYLE: Record<TripStyle, { train: string[]; bus?: string[]; hotel: HotelType }> = {
  budget: { train: ['SL', '3A'], hotel: '3star' },
  comfort: { train: ['2A', '1A', '3A'], bus: ['AC Sleeper'], hotel: '4star' },
};

async function cheapestLegs(
  set: ProviderSet,
  from: string,
  to: string,
  args: CheapestDatesArgs,
): Promise<Record<ISODate, LegOption | undefined>> {
  const style = STYLE[args.style];
  const jobs: Promise<Record<ISODate, TransportOffer | undefined>>[] = [];
  const query = { from, to, year: args.year, month: args.month, travellers: args.travellers };
  const add = (providers: TransportProvider[], classes?: string[]) => {
    for (const p of providers) jobs.push(p.cheapestByDate({ ...query, classes }));
  };
  add(set.train, style.train);
  add(set.bus, style.bus);
  add(set.flight);

  const out: Record<ISODate, LegOption | undefined> = {};
  for (const grid of await Promise.all(jobs)) {
    for (const [date, offer] of Object.entries(grid)) {
      if (!offer) continue;
      const current = out[date];
      if (!current || offer.price.amount < current.groupFare) {
        out[date] = {
          departDate: offer.departDate,
          arriveDate: offer.arriveDate,
          groupFare: offer.price.amount,
          source: offer.sourceName,
        };
      }
    }
  }
  return out;
}

/**
 * Collects onward, return and nightly hotel prices for a month from every active provider
 * and returns the cheapest per date, ready for `computeWindows`.
 * Grids cover only dates inside the chosen month (PLAN A2).
 */
export async function buildCheapestDatesInput(set: ProviderSet, args: CheapestDatesArgs): Promise<CheapestDatesInput> {
  const style = STYLE[args.style];
  const [onwardByDate, returnByDate, hotelGrids] = await Promise.all([
    cheapestLegs(set, args.from, args.to, args),
    cheapestLegs(set, args.to, args.from, args),
    Promise.all(set.hotel.map((h) => h.nightlyGroupPrice(args.to, args.year, args.month, args.travellers, style.hotel))),
  ]);

  const nightlyGroupPrice: Record<ISODate, number | undefined> = {};
  for (const grid of hotelGrids) {
    for (const [night, price] of Object.entries(grid)) {
      const current = nightlyGroupPrice[night];
      if (current === undefined || price < current) nightlyGroupPrice[night] = price;
    }
  }

  return {
    year: args.year,
    month: args.month,
    days: args.days,
    onwardByDate,
    returnByDate,
    nightlyGroupPrice,
    localPerDay: args.localPerDay,
  };
}
