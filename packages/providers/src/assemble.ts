import {
  type DateWindow,
  daysInMonth,
  distanceKm,
  matchLandmark,
  isoDate,
  type CheapestDatesInput,
  type ISODate,
  type LegOption,
  type Travellers,
} from '@tripsaver/domain';
import type {
  HotelOffer,
  HotelType,
  ProviderSet,
  TransportOffer,
  TransportProvider,
} from './interfaces.js';

export type TripStyle = 'offbeat' | 'budget' | 'comfort';

export interface CheapestDatesArgs {
  from: string;
  to: string;
  year: number;
  month: number;
  days: number;
  travellers: Travellers;
  style: TripStyle;
  localPerDay: number;
  /** "Stay near" from More preferences: the plan hotel is picked near this landmark when it is known. */
  stayNear?: string;
}

/** Which classes and hotel type each style may use (PLAN §6.3). */
/** Classes and hotel type per plan (PLAN §6.3). Offbeat: cheapest suitable travel, homestay near the spots. */
export const STYLE: Record<TripStyle, { train: string[]; bus?: string[]; hotel: HotelType }> = {
  offbeat: { train: ['SL', '3A'], hotel: 'homestay' },
  budget: { train: ['SL', '3A'], hotel: '3star' },
  comfort: { train: ['2A', '1A', '3A'], bus: ['AC Sleeper'], hotel: '4star' },
};

/** Stable id of an offer within one provider and date, so a chosen leg can be found again. */
export function offerRef(o: TransportOffer): string {
  return [o.source, o.number ?? o.operator, o.travelClass, o.departAt].join('|');
}

function toLeg(o: TransportOffer): LegOption {
  return {
    ref: offerRef(o),
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

/** Minimum guest rating for hotels in any plan (brief §2.3 B). */
export const MIN_HOTEL_RATING = 3.5;
/** With a "Stay near" landmark, the plan hotel must be within this distance of it (if any such hotel exists). */
export const STAY_NEAR_KM = 5;

/** A date window priced with the actual offers the user would book, each with source, fetchedAt and link. */
export interface PricedWindow {
  start: ISODate;
  end: ISODate;
  style: TripStyle;
  onward: TransportOffer;
  return: TransportOffer;
  /** null when no night is spent at the destination. */
  hotel: HotelOffer | null;
  /** Placeholder estimate (local transport, food, sights); always "approx.". */
  local: { perDay: number; days: number; amount: number };
  hotelNights: number;
  daysAtDestination: number;
  total: number;
  perPerson: number;
}

async function findLeg(set: ProviderSet, from: string, to: string, leg: LegOption, args: CheapestDatesArgs): Promise<TransportOffer> {
  const providers: TransportProvider[] = [...set.train, ...set.bus, ...set.flight];
  const lists = await Promise.all(providers.map((p) => p.search({ from, to, date: leg.departDate, travellers: args.travellers })));
  const offer = lists.flat().find((o) => offerRef(o) === leg.ref);
  if (!offer) throw new Error(`Offer ${leg.ref ?? '(no ref)'} is no longer available`);
  return offer;
}

/**
 * Re-prices a window from `computeWindows` with bookable offers: the same onward and return legs,
 * and the cheapest single hotel (rated 3.5+, the style's type) for the whole stay.
 */
export async function priceWindow(set: ProviderSet, args: CheapestDatesArgs, w: DateWindow): Promise<PricedWindow> {
  if (!w.feasible || !w.legs) throw new Error(`Window ${w.start} is not feasible`);
  const checkIn = w.legs.onward.arriveDate;
  const checkOut = w.legs.return.departDate;
  const [onward, back, hotels] = await Promise.all([
    findLeg(set, args.from, args.to, w.legs.onward, args),
    findLeg(set, args.to, args.from, w.legs.return, args),
    w.hotelNights > 0
      ? Promise.all(
          set.hotel.map((h) =>
            h.search({ destination: args.to, checkIn, checkOut, travellers: args.travellers, types: [STYLE[args.style].hotel] }),
          ),
        )
      : Promise.resolve([] as HotelOffer[][]),
  ]);

  const rated = hotels.flat().filter((h) => h.guestRating >= MIN_HOTEL_RATING);
  const mark = matchLandmark(args.stayNear, set.places.landmarks(args.to));
  const near = mark ? rated.filter((h) => distanceKm(mark, h) <= STAY_NEAR_KM) : [];
  const best = (near.length ? near : rated).reduce<HotelOffer | undefined>(
    (b, h) => (!b || h.cheapest.price.amount < b.cheapest.price.amount ? h : b),
    undefined,
  );
  if (w.hotelNights > 0 && !best) throw new Error(`No ${STYLE[args.style].hotel} hotel available in ${args.to} for ${checkIn}`);

  const local = { perDay: args.localPerDay, days: w.daysAtDestination, amount: args.localPerDay * w.daysAtDestination };
  const total = onward.price.amount + back.price.amount + (best?.cheapest.price.amount ?? 0) + local.amount;
  const people = args.travellers.adults + args.travellers.childAges.length;
  return {
    start: w.start,
    end: w.end,
    style: args.style,
    onward,
    return: back,
    hotel: best ?? null,
    local,
    hotelNights: w.hotelNights,
    daysAtDestination: w.daysAtDestination,
    total,
    perPerson: Math.round(total / people),
  };
}
