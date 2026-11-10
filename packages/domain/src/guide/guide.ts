import { dayOfWeek, eachDay } from '../dates.js';
import type { PlanStyle } from '../dates-engine/local-estimate.js';
import { roadKm } from '../itinerary/plan.js';
import type { LatLng } from '../hotels/hotels.js';
import type { FOOD_PREFS } from '../search/search-input.js';
import type { ISODate } from '../types.js';

/** Sights closer than this (by road) are "near your hotel"; the rest are day trips. */
export const NEAR_KM = 10;
/** Restaurants farther than this are left out unless there are too few nearby. */
export const RESTAURANT_MAX_KM = 10;
const MIN_RESTAURANTS = 3;

export type Located<T> = T & { distanceKm: number };

function withDistance<T extends LatLng>(items: T[], from: LatLng): Located<T>[] {
  return items
    .map((x) => ({ ...x, distanceKm: roadKm(from, x) }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// ── Sights (brief §3.4) ──

export const SIGHT_FILTERS = [
  'must-see',
  'nature',
  'religious',
  'adventure',
  'museums',
  'heritage',
  'nightlife',
  'kids',
] as const;
export type SightFilter = (typeof SIGHT_FILTERS)[number];

const CATEGORY_FILTER: Record<string, SightFilter> = {
  beach: 'nature',
  nature: 'nature',
  village: 'nature',
  religious: 'religious',
  adventure: 'adventure',
  museum: 'museums',
  fort: 'heritage',
  heritage: 'heritage',
  culture: 'heritage',
  nightlife: 'nightlife',
};

/** Which filter chips a sight appears under. Markets belong to Shopping, so they get none. */
export function sightFilters(a: {
  category: string;
  isHighlight: boolean;
  kidFriendly?: boolean;
}): SightFilter[] {
  const out: SightFilter[] = [];
  if (a.isHighlight) out.push('must-see');
  const c = CATEGORY_FILTER[a.category];
  if (c) out.push(c);
  if (a.kidFriendly) out.push('kids');
  return out;
}

/** Sights near the hotel (≤ 10 km by road) and day trips, nearest first, with road distance and driving time. */
export function groupSights<T extends LatLng>(
  sights: T[],
  from: LatLng,
  speedKmh: number,
): { near: Located<T & { travelMin: number }>[]; dayTrips: Located<T & { travelMin: number }>[] } {
  const all = withDistance(sights, from).map((s) => ({
    ...s,
    travelMin: Math.round((s.distanceKm / speedKmh) * 60),
  }));
  return {
    near: all.filter((s) => s.distanceKm <= NEAR_KM),
    dayTrips: all.filter((s) => s.distanceKm > NEAR_KM),
  };
}

// ── Food (brief §3.6, PLAN §6.3) ──

export type FoodPref = (typeof FOOD_PREFS)[number];

export interface RestaurantLike extends LatLng {
  id: string;
  kind: 'street' | 'homely' | 'budget' | 'restaurant';
  /** 'unknown': the source doesn't say (OpenStreetMap often doesn't). */
  vegType: 'veg' | 'non-veg' | 'both' | 'unknown';
  /** Curated places only; real (OpenStreetMap) places have no rating, price or dishes. */
  costForTwo?: number;
  rating?: number;
  reviewCount?: number;
  /** Dish ids it is known for. */
  dishes?: string[];
}

/** Typical cost for two by kind of place, when a destination has no sample places to go by. */
export const DEFAULT_COST_FOR_TWO: Record<RestaurantLike['kind'], number> = {
  street: 300,
  homely: 400,
  budget: 500,
  restaurant: 1200,
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

/**
 * "Typical for two" for a kind of place: the median of the destination's sample places of that kind,
 * else of all its sample places, else `DEFAULT_COST_FOR_TWO`. An estimate, never a real place's price.
 */
export function typicalCostForTwo(kind: RestaurantLike['kind'], samples: RestaurantLike[]): number {
  const priced = samples.filter((r) => r.costForTwo !== undefined);
  const same = priced.filter((r) => r.kind === kind);
  const pool = same.length ? same : priced;
  return pool.length ? median(pool.map((r) => r.costForTwo!)) : DEFAULT_COST_FOR_TWO[kind];
}

const VEG_ORDER: Record<RestaurantLike['vegType'], number> = { veg: 0, both: 1, unknown: 2, 'non-veg': 3 };

/** b − a when both have the value, else 0 (places without it fall through to the next rule). */
const byBoth = (a: number | undefined, b: number | undefined): number =>
  a === undefined || b === undefined ? 0 : a - b;

/** Offbeat: local, homely · Budget: street food, budget eateries · Comfort: well-reviewed restaurants. */
const KIND_ORDER: Record<PlanStyle, RestaurantLike['kind'][]> = {
  offbeat: ['homely', 'street', 'budget', 'restaurant'],
  budget: ['street', 'budget', 'homely', 'restaurant'],
  comfort: ['restaurant', 'budget', 'homely', 'street'],
};

/**
 * Where to eat for this plan: places within 10 km (or the nearest 3 if fewer), ordered by the plan's
 * kind of place, then cheapest (Budget, Offbeat) or best rated (Comfort). Vegetarian and Jain travellers
 * see pure-veg places first and no non-veg-only places.
 */
export function rankRestaurants<T extends RestaurantLike>(
  list: T[],
  from: LatLng,
  style: PlanStyle,
  food: FoodPref = 'any',
): Located<T>[] {
  const veg = food === 'veg' || food === 'jain';
  const eligible = withDistance(veg ? list.filter((r) => r.vegType !== 'non-veg') : list, from);
  const near = eligible.filter((r) => r.distanceKm <= RESTAURANT_MAX_KM);
  const pool = near.length >= MIN_RESTAURANTS ? near : eligible.slice(0, MIN_RESTAURANTS);
  const order = KIND_ORDER[style];
  return [...pool].sort(
    (a, b) =>
      (veg ? VEG_ORDER[a.vegType] - VEG_ORDER[b.vegType] : 0) ||
      order.indexOf(a.kind) - order.indexOf(b.kind) ||
      (style === 'comfort' ? byBoth(b.rating, a.rating) : byBoth(a.costForTwo, b.costForTwo)) ||
      a.distanceKm - b.distanceKm,
  );
}

/** Places known for a dish, nearest first. */
export function restaurantsForDish<T extends RestaurantLike>(
  list: T[],
  dishId: string,
  from: LatLng,
): Located<T>[] {
  return withDistance(
    list.filter((r) => r.dishes?.includes(dishId)),
    from,
  );
}

// ── Shopping (brief §3.7) ──

export interface ShopLike extends LatLng {
  id: string;
  /** Emporiums, cooperatives and GI-tag outlets are fair-price shops. */
  kind: 'market' | 'emporium' | 'cooperative' | 'gi-outlet' | 'shop';
  /** 0 = Sunday … 6 = Saturday. */
  openDays: number[];
}

const FAIR: ShopLike['kind'][] = ['emporium', 'cooperative', 'gi-outlet'];

export function splitShops<T extends ShopLike>(
  shops: T[],
  from: LatLng,
): { markets: Located<T>[]; fairPrice: Located<T>[]; others: Located<T>[] } {
  const all = withDistance(shops, from);
  return {
    markets: all.filter((s) => s.kind === 'market'),
    fairPrice: all.filter((s) => FAIR.includes(s.kind)),
    others: all.filter((s) => s.kind === 'shop'),
  };
}

/** A market that runs on 1–3 days a week ("go on its day"), as opposed to a shop open most days. */
export const WEEKLY_MAX_DAYS = 3;

export function isWeeklyMarket(openDays: number[]): boolean {
  return openDays.length > 0 && openDays.length <= WEEKLY_MAX_DAYS;
}

/** Dates a weekly market is on during the trip; empty for places open most days. */
export function marketDaysInTrip(openDays: number[], start: ISODate, end: ISODate): ISODate[] {
  if (!isWeeklyMarket(openDays)) return [];
  return eachDay(start, end).filter((d) => openDays.includes(dayOfWeek(d)));
}

// ── Do's & don'ts (brief §3.8) ──

/** Nearest hospital, police station, ATM… with its road distance, or null if none are known. */
export function nearestTo<T extends LatLng>(points: T[], from: LatLng): Located<T> | null {
  return withDistance(points, from)[0] ?? null;
}
