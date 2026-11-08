import {
  daysInMonth,
  isoDate,
  type CheapestDatesInput,
  type ISODate,
  type LegOption,
  type Travellers,
} from '@tripsaver/domain';
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

function toLeg(o: TransportOffer): LegOption {
  return {
    departDate: o.departDate,
    arriveDate: o.arriveDate,
    departTime: o.departAt.slice(11, 16),
    arriveTime: o.arriveAt.slice(11, 16),
    groupFare: o.price.amount,
    source: o.sourceName,
  };
}

/** All offers per date from every transport provider, filtered by the style's classes. */
async function offersByDate(
  set: ProviderSet,
  from: string,
  to: string,
  args: CheapestDatesArgs,
): Promise<Record<ISODate, TransportOffer[]>> {
  const style = STYLE[args.style];
  const sources: [TransportProvider, string[] | undefined][] = [
    ...set.train.map((p): [TransportProvider, string[]] => [p, style.train]),
    ...set.bus.map((p): [TransportProvider, string[] | undefined] => [p, style.bus]),
    ...set.flight.map((p): [TransportProvider, undefined] => [p, undefined]),
  ];
  const dates = Array.from({ length: daysInMonth(args.year, args.month) }, (_, i) =>
    isoDate(args.year, args.month, i + 1),
  );
  const out: Record<ISODate, TransportOffer[]> = {};
  await Promise.all(
    dates.map(async (date) => {
      const lists = await Promise.all(
        sources.map(async ([p, classes]) =>
          (await p.search({ from, to, date, travellers: args.travellers })).filter(
            (o) => !classes || classes.includes(o.travelClass),
          ),
        ),
      );
      out[date] = lists.flat();
    }),
  );
  return out;
}

/** Cheapest onward option per departure date. */
function cheapestOnward(byDate: Record<ISODate, TransportOffer[]>): Record<ISODate, LegOption | undefined> {
  const out: Record<ISODate, LegOption | undefined> = {};
  for (const [date, offers] of Object.entries(byDate)) {
    const best = offers.reduce<TransportOffer | undefined>((b, o) => (!b || o.price.amount < b.price.amount ? o : b), undefined);
    out[date] = best && toLeg(best);
  }
  return out;
}

/**
 * Return options per departure date: the cheapest for each arrival date, so the engine can
 * choose a same-day flight home when a cheaper overnight train would arrive too late.
 */
function returnOptions(byDate: Record<ISODate, TransportOffer[]>): Record<ISODate, LegOption[] | undefined> {
  const out: Record<ISODate, LegOption[] | undefined> = {};
  for (const [date, offers] of Object.entries(byDate)) {
    const byArrival = new Map<ISODate, TransportOffer>();
    for (const o of offers) {
      const current = byArrival.get(o.arriveDate);
      if (!current || o.price.amount < current.price.amount) byArrival.set(o.arriveDate, o);
    }
    out[date] = byArrival.size ? [...byArrival.values()].map(toLeg) : undefined;
  }
  return out;
}

/**
 * Collects onward, return and nightly hotel prices for a month from every active provider,
 * ready for `computeWindows`. Grids cover only dates inside the chosen month (PLAN A2).
 */
export async function buildCheapestDatesInput(set: ProviderSet, args: CheapestDatesArgs): Promise<CheapestDatesInput> {
  for (const code of [args.from, args.to]) {
    if (!set.places.get(code)) throw new Error(`Unknown place "${code}"`);
  }
  const style = STYLE[args.style];
  const [onward, back, hotelGrids] = await Promise.all([
    offersByDate(set, args.from, args.to, args),
    offersByDate(set, args.to, args.from, args),
    Promise.all(set.hotel.map((h) => h.nightlyGroupPrice(args.to, args.year, args.month, args.travellers, style.hotel))),
  ]);

  const nightlyGroupPrice: Record<ISODate, number | undefined> = {};
  for (const grid of hotelGrids) {
    for (const [night, price] of Object.entries(grid)) {
      const current = nightlyGroupPrice[night];
      if (current === undefined || price < current) nightlyGroupPrice[night] = price;
    }
  }
  if (Object.keys(nightlyGroupPrice).length === 0) {
    throw new Error(`No hotels of type ${style.hotel} in ${args.to} rated 3.5 or higher`);
  }

  return {
    year: args.year,
    month: args.month,
    days: args.days,
    onwardByDate: cheapestOnward(onward),
    returnByDate: returnOptions(back),
    nightlyGroupPrice,
    localPerDay: args.localPerDay,
  };
}
