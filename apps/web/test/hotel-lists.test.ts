import type { HotelListing } from '@tripsaver/providers';
import { describe, expect, test } from 'vitest';
import { DEFAULT_FILTERS, hotelLists } from '../lib/hotel-lists';

let n = 0;
function hotel(p: Partial<HotelListing>): HotelListing {
  n += 1;
  return {
    hotelId: `H${n}`,
    name: `Hotel ${n}`,
    type: '3star',
    stars: 3,
    guestRating: 4,
    reviewCount: 100,
    lat: 0,
    lng: 0,
    amenities: [],
    breakfastIncluded: false,
    freeCancellation: false,
    nights: 4,
    rooms: 1,
    extraBeds: 0,
    sitePrices: [],
    cheapest: {} as HotelListing['cheapest'],
    distanceKm: 1,
    totalPrice: 8000,
    perNight: 2000,
    ...p,
  };
}

const list = [
  hotel({ hotelId: '3a', stars: 3, totalPrice: 9000 }),
  hotel({ hotelId: '4a', type: '4star', stars: 4, totalPrice: 7000 }),
  hotel({ hotelId: 'r4', type: 'resort', stars: 4, totalPrice: 15000 }),
  hotel({ hotelId: '5a', type: '5star', stars: 5, totalPrice: 40000 }),
  hotel({ hotelId: 'r5', type: 'resort', stars: 5, totalPrice: 30000 }),
  hotel({ hotelId: 'low', stars: 3, guestRating: 3.2, totalPrice: 5000 }),
  hotel({ hotelId: 'home', type: 'homestay', stars: 0, totalPrice: 6000 }),
  hotel({ hotelId: 'hostel', type: 'hostel', stars: 0, totalPrice: 2000 }),
];
const ids = (xs: HotelListing[]) => xs.map((x) => x.hotelId);

describe('hotelLists', () => {
  test('3★+ (3–4 stars, resorts included) and 5★ side by side, cheapest first, 3.5+ rating by default', () => {
    const l = hotelLists(list, ['3-star', '4-star', '5-star'], DEFAULT_FILTERS, 'cheapest');
    expect(ids(l.threePlus)).toEqual(['4a', '3a', 'r4']);
    expect(ids(l.fiveStar)).toEqual(['r5', '5a']);
    expect(l.totals).toEqual({ threePlus: 4, fiveStar: 2, others: 0 });
  });

  test('both lists are always there even if the user picked only homestays; picked types get their own list', () => {
    const l = hotelLists(list, ['homestay'], DEFAULT_FILTERS, 'cheapest');
    expect(l.threePlus.length).toBeGreaterThan(0);
    expect(l.fiveStar.length).toBeGreaterThan(0);
    expect(ids(l.others)).toEqual(['home']);
  });

  test('turning the rating filter off shows the low-rated hotel', () => {
    expect(ids(hotelLists(list, ['3-star'], {}, 'cheapest').threePlus)).toContain('low');
  });
});
