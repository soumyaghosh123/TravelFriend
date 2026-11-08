import {
  daySpend,
  diffDays,
  distanceKm,
  nearestOffbeat,
  planItinerary,
  selectPlanAttractions,
  sightMinutesOf,
  splitBases,
  STYLE_LIMITS,
  type BaseCandidate,
  type LatLng,
  type ValidSearchInput,
} from '@tripsaver/domain';
import { MIN_HOTEL_RATING, STYLE, type PricedWindow, type TripStyle } from './assemble.js';
import type { Clock } from './clock.js';
import { withTimeout } from './dates-section.js';
import type { Attraction, HotelType, ProviderSet } from './interfaces.js';
import type { HotelListing, HotelsSection, ItineraryChecks, ItinerarySection, PlanBase } from './results-contract.js';

/** Hotels within this distance of a base count as "at" the base. */
const NEAR_BASE_KM = 15;

async function attractionsFor(set: ProviderSet, destination: string, ms: number): Promise<Attraction[]> {
  const lists = await Promise.all(set.attractions.map((p) => withTimeout(p.attractions(destination), ms, `${p.id} attractions`)));
  const byId = new Map<string, Attraction>();
  for (const a of lists.flat()) if (!byId.has(a.id)) byId.set(a.id, a);
  return [...byId.values()];
}

/** The style's hotel near a base: cheapest within 15 km, else the nearest of that kind. */
function hotelNear(hotels: HotelListing[], base: LatLng, pick: (h: HotelListing) => boolean): HotelListing | null {
  const ok = hotels.filter((h) => pick(h) && h.guestRating >= MIN_HOTEL_RATING);
  const near = ok.filter((h) => distanceKm(h, base) <= NEAR_BASE_KM).sort((a, b) => a.totalPrice - b.totalPrice);
  return near[0] ?? ok.sort((a, b) => distanceKm(a, base) - distanceKm(b, base))[0] ?? null;
}

/** Bookable hotel per base: the plan's own hotel for a single-base stay, otherwise the style's type near each base. */
function baseHotels(bases: ReturnType<typeof splitBases>, w: PricedWindow, hotels: HotelsSection | null, type: HotelType): PlanBase[] {
  const list = hotels?.hotels ?? [];
  return bases.map((b) => {
    const single = bases.length === 1;
    const own = single && w.hotel ? (list.find((h) => h.hotelId === w.hotel!.hotelId) ?? null) : null;
    const hotel = own ?? hotelNear(list, b, (h) => h.type === type);
    const fiveStar = hotelNear(list, b, (h) => h.stars === 5);
    return {
      id: b.id,
      name: b.name,
      lat: b.lat,
      lng: b.lng,
      nights: b.nights,
      checkIn: b.checkIn,
      hotel,
      hotelTotal: hotel ? (single ? hotel.totalPrice : hotel.perNight * b.nights) : null,
      hotelTotalIsEstimate: !single || !!hotel?.cheapest.isEstimate,
      fiveStar,
    };
  });
}

/**
 * PlanBuilder + BaseSplitter + ItineraryEngine for one plan and one priced window (PLAN §6.3–6.5):
 * picks the plan's sights, splits a region into bases, builds the day-by-day plan (validated against
 * every hard rule), adds the daily spend and a hotel (plus a 5★ option) for each base.
 * Offbeat with no offbeat spots returns `available: false` with the nearest alternative instead.
 */
export async function buildItinerarySection(
  set: ProviderSet,
  input: ValidSearchInput,
  style: TripStyle,
  w: PricedWindow,
  hotels: HotelsSection | null,
  opts: { clock: Clock; timeoutMs: number },
): Promise<ItinerarySection> {
  const place = set.places.get(input.to);
  if (!place) throw new Error(`Unknown destination "${input.to}"`);
  const all = await attractionsFor(set, input.to, opts.timeoutMs);
  const selection = selectPlanAttractions(style, all);

  if (!selection.available) {
    const others = set.places.places().filter((p) => p.code !== input.to);
    const elsewhere = (await Promise.all(others.map((p) => attractionsFor(set, p.code, opts.timeoutMs)))).flat();
    const alt = nearestOffbeat(place, elsewhere);
    return {
      style,
      available: false,
      reason: 'noOffbeat',
      nearestAlternative: alt
        ? { name: alt.name, destination: alt.destination, destinationName: set.places.get(alt.destination)?.name ?? alt.destination, distanceKm: alt.distanceKm }
        : null,
    };
  }

  const arrival = place.gateways?.[w.onward.mode] ?? { name: place.name, lat: place.lat, lng: place.lng };
  const departure = place.gateways?.[w.return.mode] ?? arrival;
  const marks = set.places.landmarks(input.to);
  const candidates: BaseCandidate[] = (marks.some((m) => m.isBase) ? marks.filter((m) => m.isBase) : marks.slice(0, 1)).map((m) => ({
    id: m.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    name: m.name,
    lat: m.lat,
    lng: m.lng,
  }));
  if (candidates.length === 0) candidates.push({ id: place.code.toLowerCase(), name: place.name, lat: place.lat, lng: place.lng });

  const arriveAt = w.onward.arriveAt.slice(0, 16);
  const leaveAt = w.return.departAt.slice(0, 16);
  const nights = Math.max(0, diffDays(arriveAt.slice(0, 10), leaveAt.slice(0, 10)));
  const split = splitBases(candidates, selection.attractions, nights, arriveAt.slice(0, 10), arrival);
  // One base: it is wherever the plan's priced hotel is (named after the nearest candidate area),
  // so every day starts and ends at the hotel you actually booked.
  const hotel = w.hotel;
  const bases =
    split.length === 1 && hotel
      ? (() => {
          const near = [...candidates].sort((a, b) => distanceKm(a, hotel) - distanceKm(b, hotel))[0]!;
          return [{ ...split[0]!, id: near.id, name: near.name, lat: hotel.lat, lng: hotel.lng }];
        })()
      : split;

  const it = planItinerary({
    start: w.start,
    days: input.days,
    arrive: arriveAt,
    leave: leaveAt,
    home: w.return.arriveAt.slice(0, 16),
    arrivalPoint: arrival,
    departurePoint: departure,
    bases,
    attractions: selection.attractions,
    limits: {
      ...STYLE_LIMITS[style],
      ...(place.localSpeedKmh ? { speedKmh: place.localSpeedKmh } : {}),
      departureBufferMin: w.return.mode === 'flight' ? 120 : 45,
    },
  });

  const byId = new Map(selection.attractions.map((a) => [a.id, a]));
  const days = it.days.map((d) => ({ ...d, spend: daySpend(d, byId, input.travellers, style) }));
  const scheduled = new Set(days.flatMap((d) => d.stops.map((s) => s.attractionId).filter((x): x is string => !!x)));
  const busiest = days.reduce((a, b) => (b.activeMin > a.activeMin ? b : a));
  const checks: ItineraryChecks = {
    days: days.length,
    busiest: { index: busiest.index, activeMin: busiest.activeMin },
    closedDays: selection.attractions.filter((a) => scheduled.has(a.id) && a.closedDays.length > 0).map((a) => ({ name: a.name, closedDays: a.closedDays })),
    freeDay: days.find((d) => d.kind === 'free')?.index ?? null,
    first: { kind: days[0]!.kind, sightMin: sightMinutesOf(days[0]!.stops) },
    last: { kind: days.at(-1)!.kind, sightMin: sightMinutesOf(days.at(-1)!.stops) },
    nightsAtBases: days.filter((d) => bases.some((b) => b.id === d.nightAt)).length,
  };

  return {
    style,
    available: true,
    start: w.start,
    end: w.end,
    days,
    bases: baseHotels(bases, w, hotels, STYLE[style].hotel),
    attractions: Object.fromEntries(selection.attractions.map((a) => [a.id, a as Attraction])),
    unscheduled: it.unscheduled,
    arrivalPoint: arrival.name,
    departurePoint: departure.name,
    checks,
    limits: it.limits,
    sampleData: set.attractions.every((p) => p.id.startsWith('mock')),
    fetchedAt: opts.clock().toISOString(),
  };
}
