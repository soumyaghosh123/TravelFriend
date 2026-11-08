import type { Travellers } from '../types.js';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

/** The landmark the user means by "Stay near …": any landmark word appears in the text, or the other way round. */
export function matchLandmark<L extends { name: string }>(text: string | undefined, landmarks: L[]): L | null {
  const typed = words(text ?? '');
  if (typed.length === 0) return null;
  return (
    landmarks.find((l) => {
      const name = words(l.name);
      return name.some((w) => typed.includes(w));
    }) ?? null
  );
}

/**
 * Extra beds for a stay: each room sleeps 2 adult-priced guests (adults and children 8+);
 * younger children share a bed (brief §2.4). Anyone beyond that needs an extra bed.
 */
export function extraBedsNeeded(t: Travellers, rooms: number): number {
  const adultLike = t.adults + t.childAges.filter((a) => a >= 8).length;
  return Math.max(0, adultLike - 2 * rooms);
}

/** What the hotel filters and sorts need. `distanceKm` is null when there's no landmark to measure from. */
export interface HotelLike {
  stars: number;
  guestRating: number;
  totalPrice: number;
  nights: number;
  distanceKm: number | null;
  freeCancellation: boolean;
  breakfastIncluded: boolean;
  amenities: string[];
}

export interface HotelFilters {
  minRating?: number;
  freeCancellation?: boolean;
  breakfast?: boolean;
  /** All of these must be present (e.g. Pool, Parking, Couple-friendly). */
  amenities?: string[];
  maxDistanceKm?: number;
  maxPerNight?: number;
}

export function filterHotels<H extends HotelLike>(list: H[], f: HotelFilters): H[] {
  return list.filter(
    (x) =>
      (f.minRating === undefined || x.guestRating >= f.minRating) &&
      (!f.freeCancellation || x.freeCancellation) &&
      (!f.breakfast || x.breakfastIncluded) &&
      (f.amenities ?? []).every((a) => x.amenities.includes(a)) &&
      (f.maxDistanceKm === undefined || (x.distanceKm !== null && x.distanceKm <= f.maxDistanceKm)) &&
      (f.maxPerNight === undefined || x.totalPrice / Math.max(1, x.nights) <= f.maxPerNight),
  );
}

export type HotelSort = 'cheapest' | 'nearest' | 'value' | 'rating';

/** Price ÷ rating (brief §3.1 "Best value"): lower is better. */
export function valueScore(x: HotelLike): number {
  return x.totalPrice / Math.max(0.1, x.guestRating);
}

export function sortHotels<H extends HotelLike>(list: H[], by: HotelSort): H[] {
  const key: Record<HotelSort, (x: H) => number> = {
    cheapest: (x) => x.totalPrice,
    nearest: (x) => x.distanceKm ?? Number.POSITIVE_INFINITY,
    value: valueScore,
    rating: (x) => -x.guestRating,
  };
  return [...list].sort((a, b) => key[by](a) - key[by](b) || a.totalPrice - b.totalPrice);
}

export interface PriceLevel {
  level: 'lower' | 'usual' | 'higher';
  /** Difference from the month's average nightly price, rounded, always positive. */
  pct: number;
}

/** "Prices for these dates are lower / higher than usual" (brief §3.1): stay nights vs every night in the month. */
export function priceLevelHint(stayNights: number[], monthNights: number[], threshold = 0.08): PriceLevel | null {
  if (stayNights.length === 0 || monthNights.length === 0) return null;
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const diff = avg(stayNights) / avg(monthNights) - 1;
  const pct = Math.round(Math.abs(diff) * 100);
  return { level: diff <= -threshold ? 'lower' : diff >= threshold ? 'higher' : 'usual', pct };
}
