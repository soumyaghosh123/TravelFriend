import {
  filterHotels,
  sortHotels,
  type HotelFilters,
  type HotelSort,
  type HotelType as SearchHotelType,
} from '@tripsaver/domain';
import type { HotelListing } from '@tripsaver/providers';

/** Filters the tab starts with: the brief's minimum guest rating (3.5) on, everything else off. */
export const DEFAULT_FILTERS: HotelFilters = { minRating: 3.5 };
export const DEFAULT_SORT: HotelSort = 'cheapest';

/** Search-form hotel types → provider hotel types. */
const TYPE_MAP: Record<SearchHotelType, HotelListing['type']> = {
  budget: 'budget',
  '3-star': '3star',
  '4-star': '4star',
  '5-star': '5star',
  homestay: 'homestay',
  resort: 'resort',
  hostel: 'hostel',
};

export interface HotelLists {
  /** 3★ and 4★ properties (brief §3.1: "minimum 3-star"). */
  threePlus: HotelListing[];
  fiveStar: HotelListing[];
  /** Types the user asked for that neither list covers (budget, homestay, hostel). Empty if none chosen. */
  others: HotelListing[];
  /** How many hotels each list had before filters, for "showing 4 of 7". */
  totals: { threePlus: number; fiveStar: number; others: number };
}

/** Splits the stay's hotels into the side-by-side lists, then filters and sorts each one. */
export function hotelLists(
  hotels: HotelListing[],
  chosen: SearchHotelType[],
  filters: HotelFilters,
  sort: HotelSort,
): HotelLists {
  const wanted = new Set(chosen.map((c) => TYPE_MAP[c]));
  const threePlus = hotels.filter((h) => h.stars >= 3 && h.stars < 5);
  const fiveStar = hotels.filter((h) => h.stars === 5);
  const others = hotels.filter((h) => h.stars < 3 && wanted.has(h.type));
  const apply = (xs: HotelListing[]) => sortHotels(filterHotels(xs, filters), sort);
  return {
    threePlus: apply(threePlus),
    fiveStar: apply(fiveStar),
    others: apply(others),
    totals: { threePlus: threePlus.length, fiveStar: fiveStar.length, others: others.length },
  };
}
