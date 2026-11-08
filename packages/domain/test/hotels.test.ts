import { describe, expect, test } from 'vitest';
import {
  distanceKm,
  extraBedsNeeded,
  filterHotels,
  matchLandmark,
  priceLevelHint,
  sortHotels,
  valueScore,
  type HotelFilters,
  type HotelLike,
} from '../src/hotels/hotels.js';

describe('distanceKm (haversine)', () => {
  test('zero for the same point; one degree of latitude is about 111.2 km', () => {
    expect(distanceKm({ lat: 15.49, lng: 73.83 }, { lat: 15.49, lng: 73.83 })).toBe(0);
    expect(distanceKm({ lat: 15, lng: 73.83 }, { lat: 16, lng: 73.83 })).toBeCloseTo(111.19, 1);
  });
});

describe('matchLandmark', () => {
  const marks = [
    { name: 'Calangute Beach', lat: 15.54, lng: 73.76 },
    { name: 'Panjim (Panaji)', lat: 15.49, lng: 73.83 },
  ];
  test('case-insensitive, either direction, ignoring extra words', () => {
    expect(matchLandmark('calangute', marks)?.name).toBe('Calangute Beach');
    expect(matchLandmark('Near Calangute Beach please', marks)?.name).toBe('Calangute Beach');
    expect(matchLandmark('panaji', marks)?.name).toBe('Panjim (Panaji)');
  });
  test('no text or no match → null', () => {
    expect(matchLandmark(undefined, marks)).toBeNull();
    expect(matchLandmark('  ', marks)).toBeNull();
    expect(matchLandmark('Mumbai airport', marks)).toBeNull();
  });
});

describe('extraBedsNeeded (brief §2.4: about 2 adult-priced guests per room; younger children share)', () => {
  test('suggested rooms never need an extra bed', () => {
    expect(extraBedsNeeded({ adults: 2, childAges: [3, 6] }, 1)).toBe(0);
    expect(extraBedsNeeded({ adults: 4, childAges: [] }, 2)).toBe(0);
  });
  test('children 8+ count like adults; squeezing into fewer rooms needs extra beds', () => {
    expect(extraBedsNeeded({ adults: 2, childAges: [10] }, 1)).toBe(1);
    expect(extraBedsNeeded({ adults: 3, childAges: [12, 9] }, 2)).toBe(1);
    expect(extraBedsNeeded({ adults: 2, childAges: [5, 6, 7] }, 1)).toBe(0); // young children share beds
  });
});

const h = (p: Partial<HotelLike> & { id: string }): HotelLike & { id: string } => ({
  stars: 3,
  guestRating: 4,
  totalPrice: 10000,
  nights: 5,
  distanceKm: 1,
  freeCancellation: false,
  breakfastIncluded: false,
  amenities: [],
  ...p,
});

describe('filterHotels', () => {
  const list = [
    h({ id: 'a', guestRating: 3.2 }),
    h({ id: 'b', freeCancellation: true, breakfastIncluded: true, amenities: ['Pool'] }),
    h({ id: 'c', distanceKm: 6, amenities: ['Parking', 'Couple-friendly'] }),
    h({ id: 'd', distanceKm: null, totalPrice: 50000 }),
  ];
  const ids = (f: Partial<HotelFilters>) => filterHotels(list, f).map((x) => x.id);

  test('each filter on its own', () => {
    expect(ids({ minRating: 3.5 })).toEqual(['b', 'c', 'd']);
    expect(ids({ freeCancellation: true })).toEqual(['b']);
    expect(ids({ breakfast: true })).toEqual(['b']);
    expect(ids({ amenities: ['Pool'] })).toEqual(['b']);
    expect(ids({ amenities: ['Parking', 'Couple-friendly'] })).toEqual(['c']);
    expect(ids({ maxDistanceKm: 2 })).toEqual(['a', 'b']); // unknown distance never passes a distance filter
    expect(ids({ maxPerNight: 2000 })).toEqual(['a', 'b', 'c']);
  });
  test('no filters → everything', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('sortHotels (brief §3.1)', () => {
  const list = [
    h({ id: 'cheap', totalPrice: 6000, guestRating: 3.6, distanceKm: 4 }),
    h({ id: 'near', totalPrice: 9000, guestRating: 4.0, distanceKm: 0.3 }),
    h({ id: 'top', totalPrice: 20000, guestRating: 4.8, distanceKm: 2 }),
    h({ id: 'value', totalPrice: 7000, guestRating: 4.6, distanceKm: null }),
  ];
  const ids = (by: Parameters<typeof sortHotels>[1]) => sortHotels(list, by).map((x) => x.id);

  test('cheapest, nearest (unknown distance last), highest rated', () => {
    expect(ids('cheapest')).toEqual(['cheap', 'value', 'near', 'top']);
    expect(ids('nearest')).toEqual(['near', 'top', 'cheap', 'value']);
    expect(ids('rating')).toEqual(['top', 'value', 'near', 'cheap']);
  });
  test('best value = price ÷ rating score, lowest first', () => {
    expect(valueScore(h({ id: 'x', totalPrice: 7000, guestRating: 4.6 }))).toBeCloseTo(7000 / 4.6);
    expect(ids('value')[0]).toBe('value');
  });
  test('does not mutate the input', () => {
    const before = list.map((x) => x.id);
    sortHotels(list, 'rating');
    expect(list.map((x) => x.id)).toEqual(before);
  });
});

describe('priceLevelHint', () => {
  test('lower / usual / higher than the month, with the percentage', () => {
    expect(priceLevelHint([1000, 1000], [1000, 1250, 1250])).toEqual({ level: 'lower', pct: 14 });
    expect(priceLevelHint([1000], [1000, 1040])).toEqual({ level: 'usual', pct: 2 });
    expect(priceLevelHint([1800, 1800], [1000, 1500])).toEqual({ level: 'higher', pct: 44 });
  });
  test('no nights → null', () => {
    expect(priceLevelHint([], [1000])).toBeNull();
    expect(priceLevelHint([1000], [])).toBeNull();
  });
});
