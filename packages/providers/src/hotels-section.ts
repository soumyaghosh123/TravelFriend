import {
  diffDays,
  distanceKm,
  eachDay,
  addDays,
  extraBedsNeeded,
  matchLandmark,
  priceLevelHint,
  suggestRooms,
  type ISODate,
  type Travellers,
} from '@tripsaver/domain';
import type { Clock } from './clock.js';
import { withTimeout } from './dates-section.js';
import type { HotelOffer, ProviderSet } from './interfaces.js';
import type { HotelListing, HotelsSection } from './results-contract.js';

export interface HotelsArgs {
  to: string;
  checkIn: ISODate;
  checkOut: ISODate;
  travellers: Travellers;
  stayNear?: string;
}

/** Same hotel from two providers: keep the one with the cheaper best site. */
function dedupe(offers: HotelOffer[]): HotelOffer[] {
  const best = new Map<string, HotelOffer>();
  for (const o of offers) {
    const cur = best.get(o.hotelId);
    if (!cur || o.cheapest.price.amount < cur.cheapest.price.amount) best.set(o.hotelId, o);
  }
  return [...best.values()];
}

/** The month's cheapest well-rated 3★ price per night, for "lower / higher than usual". */
async function nightGrid(set: ProviderSet, args: HotelsArgs, ms: number): Promise<Record<ISODate, number>> {
  const [y, m] = args.checkIn.split('-').map(Number) as [number, number];
  const grids = await Promise.all(
    set.hotel.map((h) =>
      withTimeout(h.nightlyGroupPrice(args.to, y, m, args.travellers, '3star'), ms, `${h.name} grid`).catch(() => ({}) as Record<ISODate, number>),
    ),
  );
  const out: Record<ISODate, number> = {};
  for (const g of grids) for (const [d, p] of Object.entries(g)) if (out[d] === undefined || p < out[d]!) out[d] = p;
  return out;
}

/**
 * Every hotel for the stay from every hotel provider (brief §3.1): per-site prices with the cheapest
 * highlighted and pre-filled booking links, distance from the landmark, extra beds, the hotel's
 * restaurant prices, and whether these dates are dearer or cheaper than usual.
 * Rating, type and amenity filters are applied by the UI so the user can change them freely.
 */
export async function buildHotelsSection(
  set: ProviderSet,
  args: HotelsArgs,
  opts: { clock: Clock; timeoutMs: number },
): Promise<HotelsSection> {
  const nights = diffDays(args.checkIn, args.checkOut);
  const rooms = args.travellers.rooms ?? suggestRooms(args.travellers);
  const marks = set.places.landmarks(args.to);
  const matched = matchLandmark(args.stayNear, marks);
  const landmark = matched ?? marks[0] ?? null;

  const [lists, grid] = await Promise.all([
    nights > 0
      ? Promise.all(
          set.hotel.map((h) =>
            withTimeout(h.search({ destination: args.to, checkIn: args.checkIn, checkOut: args.checkOut, travellers: args.travellers }), opts.timeoutMs, h.name),
          ),
        )
      : Promise.resolve([] as HotelOffer[][]),
    nights > 0 ? nightGrid(set, args, opts.timeoutMs) : Promise.resolve({} as Record<ISODate, number>),
  ]);

  const hotels: HotelListing[] = dedupe(lists.flat()).map((h) => ({
    ...h,
    distanceKm: landmark ? Math.round(distanceKm(landmark, h) * 10) / 10 : null,
    totalPrice: h.cheapest.price.amount,
    perNight: Math.round(h.cheapest.price.amount / Math.max(1, h.nights)),
  }));

  const stay = nights > 0 ? eachDay(args.checkIn, addDays(args.checkOut, -1)) : [];
  const priceHint = priceLevelHint(
    stay.map((d) => grid[d]).filter((p): p is number => p !== undefined),
    Object.values(grid),
  );

  return {
    destination: { code: args.to, name: set.places.get(args.to)?.name ?? args.to },
    checkIn: args.checkIn,
    checkOut: args.checkOut,
    nights,
    rooms,
    extraBeds: extraBedsNeeded(args.travellers, rooms),
    landmark: landmark ? { name: landmark.name, matched: !!matched } : null,
    hotels,
    priceHint,
    sampleData: set.hotel.every((h) => h.id.startsWith('mock')),
    fetchedAt: opts.clock().toISOString(),
  };
}
