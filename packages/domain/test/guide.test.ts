import { describe, expect, test } from 'vitest';
import {
  groupSights,
  isWeeklyMarket,
  marketDaysInTrip,
  nearestTo,
  rankRestaurants,
  restaurantsForDish,
  sightFilters,
  splitShops,
  typicalCostForTwo,
  type RestaurantLike,
  type ShopLike,
} from '../src/guide/guide.js';

const hotel = { lat: 15.55, lng: 73.75 };
// ~1.1 km per 0.01° latitude here.
const at = (dLat: number) => ({ lat: hotel.lat + dLat, lng: hotel.lng });

describe('sightFilters (brief §3.4 groups)', () => {
  test('category and flags map to filter chips', () => {
    expect(sightFilters({ category: 'beach', isHighlight: true, kidFriendly: true })).toEqual([
      'must-see',
      'nature',
      'kids',
    ]);
    expect(sightFilters({ category: 'religious', isHighlight: false })).toEqual(['religious']);
    expect(sightFilters({ category: 'fort', isHighlight: false })).toEqual(['heritage']);
    expect(sightFilters({ category: 'museum', isHighlight: false })).toEqual(['museums']);
    expect(sightFilters({ category: 'nightlife', isHighlight: false })).toEqual(['nightlife']);
    expect(sightFilters({ category: 'adventure', isHighlight: false })).toEqual(['adventure']);
    expect(sightFilters({ category: 'market', isHighlight: false })).toEqual([]);
  });
});

describe('groupSights', () => {
  const sights = [
    { id: 'far', ...at(0.5) }, // ~55 km
    { id: 'near2', ...at(0.06) }, // ~6.7 km straight, ~8.7 km by road
    { id: 'near1', ...at(0.01) }, // ~1 km
  ];
  test('within 10 km of the hotel, nearest first; the rest are day trips; road distance and time', () => {
    const g = groupSights(sights, hotel, 30);
    expect(g.near.map((s) => s.id)).toEqual(['near1', 'near2']);
    expect(g.dayTrips.map((s) => s.id)).toEqual(['far']);
    const far = g.dayTrips[0]!;
    expect(far.distanceKm).toBeGreaterThan(55); // road factor on top of ~55.6 km straight line
    expect(far.travelMin).toBe(Math.round((far.distanceKm / 30) * 60));
  });
});

const r = (
  id: string,
  kind: RestaurantLike['kind'],
  costForTwo: number,
  rating: number,
  dLat: number,
  vegType: RestaurantLike['vegType'] = 'both',
  dishes: string[] = [],
): RestaurantLike => ({
  id,
  kind,
  costForTwo,
  rating,
  reviewCount: 100,
  vegType,
  dishes,
  ...at(dLat),
});

describe('rankRestaurants (PLAN §6.3 food per plan)', () => {
  const list = [
    r('fine', 'restaurant', 2400, 4.6, 0.01),
    r('shack', 'street', 400, 4.3, 0.02),
    r('thali', 'budget', 500, 4.4, 0.03),
    r('home', 'homely', 450, 4.5, 0.04),
    r('veg', 'budget', 350, 4.2, 0.02, 'veg'),
    r('faraway', 'street', 200, 4.8, 0.5),
  ];
  test('budget: street food and budget eateries first, cheapest first; far places dropped', () => {
    expect(rankRestaurants(list, hotel, 'budget', 'any').map((x) => x.id)).toEqual([
      'shack',
      'veg',
      'thali',
      'home',
      'fine',
    ]);
  });
  test('offbeat: homely local places first', () => {
    expect(rankRestaurants(list, hotel, 'offbeat', 'any')[0]!.id).toBe('home');
  });
  test('comfort: well-reviewed restaurants first, best rated first', () => {
    expect(
      rankRestaurants(list, hotel, 'comfort', 'any')
        .map((x) => x.id)
        .slice(0, 2),
    ).toEqual(['fine', 'thali']);
  });
  test('vegetarian or Jain travellers: pure-veg places only, then places that serve veg', () => {
    expect(rankRestaurants(list, hotel, 'budget', 'veg').map((x) => x.id)[0]).toBe('veg');
    expect(
      rankRestaurants([r('nv', 'street', 300, 4, 0.01, 'non-veg'), ...list], hotel, 'budget', 'jain').map(
        (x) => x.id,
      ),
    ).not.toContain('nv');
  });
  test('fewer than 3 nearby → the nearest 3 anyway, with their distance', () => {
    const sparse = [
      r('a', 'street', 300, 4, 0.3),
      r('b', 'street', 300, 4, 0.5),
      r('c', 'street', 300, 4, 0.9),
      r('d', 'street', 300, 4, 1.2),
    ];
    const out = rankRestaurants(sparse, hotel, 'budget', 'any');
    expect(out.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(out[0]!.distanceKm).toBeGreaterThan(30);
  });
});

describe('restaurantsForDish', () => {
  test('places that serve the dish, nearest first', () => {
    const list = [
      r('x', 'street', 300, 4, 0.05, 'both', ['fish-curry']),
      r('y', 'budget', 300, 4, 0.01, 'both', ['fish-curry']),
      r('z', 'budget', 300, 4, 0.01),
    ];
    expect(restaurantsForDish(list, 'fish-curry', hotel).map((x) => x.id)).toEqual(['y', 'x']);
  });
});

const shop = (id: string, kind: ShopLike['kind'], openDays: number[], dLat: number): ShopLike => ({
  id,
  kind,
  openDays,
  ...at(dLat),
});

describe('splitShops and weekly markets', () => {
  test('markets nearest first; fair-price shops (emporium, cooperative, GI outlet) apart; others last', () => {
    const s = splitShops(
      [
        shop('m2', 'market', [3], 0.1),
        shop('emp', 'emporium', [1, 2, 3, 4, 5, 6], 0.2),
        shop('m1', 'market', [5], 0.05),
        shop('gi', 'gi-outlet', [0, 1, 2, 3, 4, 5, 6], 0.3),
        shop('mall', 'shop', [0, 1, 2, 3, 4, 5, 6], 0.01),
      ],
      hotel,
    );
    expect(s.markets.map((x) => x.id)).toEqual(['m1', 'm2']);
    expect(s.fairPrice.map((x) => x.id)).toEqual(['emp', 'gi']);
    expect(s.others.map((x) => x.id)).toEqual(['mall']);
  });
  test('the dates a weekly market (open ≤ 3 days a week) falls on during the trip; none for shops open most days', () => {
    // 2026-12-04 is a Friday.
    expect(marketDaysInTrip([5], '2026-12-01', '2026-12-10')).toEqual(['2026-12-04']);
    expect(marketDaysInTrip([3, 6], '2026-12-01', '2026-12-06')).toEqual(['2026-12-02', '2026-12-05']);
    expect(marketDaysInTrip([0, 1, 2, 3, 4, 5, 6], '2026-12-01', '2026-12-03')).toEqual([]);
    expect(marketDaysInTrip([1, 2, 3, 4, 5, 6], '2026-12-01', '2026-12-03')).toEqual([]);
    expect(isWeeklyMarket([5])).toBe(true);
    expect(isWeeklyMarket([1, 2, 3, 4])).toBe(false);
    expect(marketDaysInTrip([0], '2026-12-01', '2026-12-05')).toEqual([]);
  });
});

describe('nearestTo', () => {
  test('nearest point with its distance, or null', () => {
    const n = nearestTo(
      [
        { name: 'B', ...at(0.2) },
        { name: 'A', ...at(0.05) },
      ],
      hotel,
    );
    expect(n?.name).toBe('A');
    expect(n?.distanceKm).toBeGreaterThan(5);
    expect(nearestTo([], hotel)).toBeNull();
  });
});

// OpenStreetMap places have no rating, price or dishes (spec 2026-11-10-osm-restaurants).
const osm = (
  id: string,
  kind: RestaurantLike['kind'],
  dLat: number,
  vegType: RestaurantLike['vegType'] = 'unknown',
): RestaurantLike => ({ id, kind, vegType, ...at(dLat) });

describe('rankRestaurants with places that have no rating or price', () => {
  test('veg traveller: veg, then both, then unknown; non-veg dropped', () => {
    const list = [
      osm('unknown', 'street', 0.01),
      osm('both', 'street', 0.02, 'both'),
      osm('veg', 'street', 0.03, 'veg'),
      osm('nonveg', 'street', 0.01, 'non-veg'),
    ];
    expect(rankRestaurants(list, hotel, 'budget', 'veg').map((x) => x.id)).toEqual([
      'veg',
      'both',
      'unknown',
    ]);
  });
  test('comfort without ratings: kind order, then distance', () => {
    const list = [
      osm('far-rest', 'restaurant', 0.02),
      osm('near-rest', 'restaurant', 0.01),
      osm('budget', 'budget', 0.005),
    ];
    expect(rankRestaurants(list, hotel, 'comfort', 'any').map((x) => x.id)).toEqual([
      'near-rest',
      'far-rest',
      'budget',
    ]);
  });
  test('budget without costForTwo: kind order, then distance', () => {
    const list = [osm('far', 'street', 0.02), osm('near', 'street', 0.01)];
    expect(rankRestaurants(list, hotel, 'budget', 'any').map((x) => x.id)).toEqual(['near', 'far']);
  });
});

describe('typicalCostForTwo', () => {
  const c = (kind: RestaurantLike['kind'], costForTwo: number): RestaurantLike => ({
    id: `${kind}-${costForTwo}`,
    kind,
    costForTwo,
    vegType: 'both',
    ...at(0),
  });
  test('median of the same kind of sample places', () => {
    expect(typicalCostForTwo('street', [c('street', 200), c('street', 600), c('street', 400)])).toBe(400);
  });
  test('no sample of that kind: median of all samples', () => {
    expect(typicalCostForTwo('street', [c('restaurant', 1000), c('restaurant', 2000)])).toBe(1500);
  });
  test('no samples at all: default for the kind', () => {
    expect(typicalCostForTwo('street', [])).toBe(300);
  });
});

test('restaurantsForDish ignores places without dishes', () => {
  expect(restaurantsForDish([osm('x', 'street', 0.01)], 'fish-curry', hotel)).toEqual([]);
});
