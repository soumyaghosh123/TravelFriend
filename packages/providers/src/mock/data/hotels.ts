import type { SiteId } from '../../deeplinks/index.js';
import type { HotelType } from '../../interfaces.js';
import { draw } from '../rng.js';
import { MOCK_DESTINATIONS } from './places.js';

export interface MockHotel {
  hotelId: string;
  name: string;
  type: HotelType;
  stars: number;
  guestRating: number;
  reviewCount: number;
  lat: number;
  lng: number;
  amenities: string[];
  breakfastIncluded: boolean;
  freeCancellation: boolean;
  /** Typical nightly rate for one room, before season and tax. */
  baseRoomRate: number;
  sites: SiteId[];
}

export const HOTEL_SITES: SiteId[] = ['booking', 'agoda', 'makemytrip', 'goibibo', 'expedia'];

type Spec = [type: HotelType, stars: number, rating: number, baseRate: number, amenities: string[]];

/** 16 hotels per destination: all 7 types, 4 five-star, 3 rated under 3.5. */
const SPECS: Spec[] = [
  ['budget', 2, 3.9, 1200, ['Wi-Fi']],
  ['budget', 2, 3.2, 900, ['Wi-Fi']],
  ['hostel', 0, 4.3, 600, ['Wi-Fi', 'Lockers', 'Common kitchen']],
  ['hostel', 0, 3.1, 450, ['Lockers']],
  ['3star', 3, 3.9, 1650, ['Wi-Fi', 'Restaurant']],
  ['3star', 3, 4.1, 1890, ['Wi-Fi', 'Pool', 'Restaurant']],
  ['3star', 3, 3.3, 1500, ['Wi-Fi']],
  ['4star', 4, 4.3, 3100, ['Wi-Fi', 'Pool', 'Parking', 'Restaurant']],
  ['4star', 4, 4.0, 2800, ['Wi-Fi', 'Parking', 'Restaurant']],
  ['5star', 5, 4.6, 11000, ['Wi-Fi', 'Pool', 'Spa', 'Kids club', 'Restaurant']],
  ['5star', 5, 4.7, 13500, ['Wi-Fi', 'Pool', 'Spa', 'Restaurant']],
  ['5star', 5, 4.4, 9500, ['Wi-Fi', 'Pool', 'Gym', 'Restaurant']],
  ['homestay', 0, 4.6, 1800, ['Home-cooked meals', 'Parking']],
  ['homestay', 0, 4.2, 1400, ['Home-cooked meals']],
  ['resort', 4, 4.4, 5200, ['Pool', 'Spa', 'Restaurant']],
  ['resort', 5, 4.5, 8800, ['Pool', 'Spa', 'Kids club', 'Restaurant']],
];

/** Fictional property names, one per spec row. */
const NAMES: Record<string, string[]> = {
  GOA: [
    'Baga Budget Stay', 'Calangute Rest House', 'Sunset Backpackers', 'Palm Shack Hostel', 'Casa Calangute Inn',
    'Sea Breeze Residency', 'Harbour View Lodge', 'Palm Grove Retreat', 'Fontainhas Heritage Hotel',
    'Azure Bay Resort & Spa', 'The Fort Cliff Palace', 'Mandovi Grand', 'Divar Island Homestay',
    'Netravali Eco Stay', 'Cabo de Rama Beach Resort', 'Candolim Luxury Resort',
  ],
};

const SUFFIXES = [
  'Budget Inn', 'Rest House', 'Backpackers', 'Hostel', 'Residency', 'Comfort Hotel', 'Lodge', 'Grand',
  'Heritage Hotel', 'Palace Hotel', 'Royal Retreat', 'Luxury Suites', 'Family Homestay', 'Village Stay',
  'Valley Resort', 'Spa Resort',
];

const PRICE_LEVEL: Record<string, number> = { GOA: 1, MANALI: 0.85, JAIPUR: 0.9, KERALA: 1.05, DARJEELING: 0.8 };

function sitesFor(hotelId: string): SiteId[] {
  const ranked = [...HOTEL_SITES].sort((a, b) => draw(`${hotelId}|${a}`) - draw(`${hotelId}|${b}`));
  const count = draw(`${hotelId}|n`) < 0.5 ? 3 : 4;
  return HOTEL_SITES.filter((s) => ranked.slice(0, count).includes(s));
}

export const MOCK_HOTELS: Record<string, MockHotel[]> = Object.fromEntries(
  MOCK_DESTINATIONS.map((d) => [
    d.code,
    SPECS.map(([type, stars, rating, baseRate, amenities], i): MockHotel => {
      const hotelId = `${d.code}-H${String(i + 1).padStart(2, '0')}`;
      return {
        hotelId,
        name: NAMES[d.code]?.[i] ?? `${d.name} ${SUFFIXES[i]}`,
        type,
        stars,
        guestRating: rating,
        reviewCount: 120 + Math.floor(draw(`${hotelId}|reviews`) * 5000),
        lat: d.lat + (draw(`${hotelId}|lat`) - 0.5) * 0.2,
        lng: d.lng + (draw(`${hotelId}|lng`) - 0.5) * 0.2,
        amenities,
        breakfastIncluded: draw(`${hotelId}|bf`) < 0.6,
        freeCancellation: draw(`${hotelId}|fc`) < 0.5,
        baseRoomRate: Math.round(baseRate * (PRICE_LEVEL[d.code] ?? 1)),
        sites: sitesFor(hotelId),
      };
    }),
  ]),
);
