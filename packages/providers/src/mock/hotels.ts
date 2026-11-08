import {
  addDays,
  daysInMonth,
  diffDays,
  eachDay,
  extraBedsNeeded,
  isoDate,
  suggestRooms,
  validateTravellers,
  type ISODate,
  type Travellers,
} from '@tripsaver/domain';
import type { Clock } from '../clock.js';
import { buildDeepLink, SITE_NAMES } from '../deeplinks/index.js';
import type { HotelOffer, HotelProvider, HotelQuery, HotelSitePrice, HotelType } from '../interfaces.js';
import { MOCK_CLIMATE, MOCK_EVENTS } from './data/calendar.js';
import { MOCK_HOTELS, type MockHotel } from './data/hotels.js';
import { mockPlaceDirectory } from './data/places.js';
import { mockDailyPrice } from './pricing-model.js';
import { draw } from './rng.js';

const TAX = 1.12;
const MIN_RATING = 3.5;

export class MockHotelProvider implements HotelProvider {
  id = 'mock-hotels';
  name = 'Sample hotels';

  constructor(
    private clock: Clock,
    private catalogue: Record<string, MockHotel[]> = MOCK_HOTELS,
  ) {}

  /** Group cost for one night (all rooms + extra beds), before tax. Children under 8 share a bed. */
  private nightly(h: MockHotel, destination: string, night: ISODate, rooms: number, extraBeds: number): number {
    const room = mockDailyPrice({
      base: h.baseRoomRate,
      date: night,
      destination,
      key: h.hotelId,
      events: MOCK_EVENTS[destination] ?? [],
      climate: MOCK_CLIMATE[destination] ?? [],
    });
    // Extra beds follow the same seasonal swing as the room rate.
    return room * rooms + Math.round((room * h.extraBedRate) / h.baseRoomRate) * extraBeds;
  }

  async search(q: HotelQuery): Promise<HotelOffer[]> {
    validateTravellers(q.travellers);
    if (q.checkOut <= q.checkIn) {
      throw new RangeError(`Check-out (${q.checkOut}) must be after check-in (${q.checkIn})`);
    }
    const place = mockPlaceDirectory.get(q.destination);
    const rooms = q.travellers.rooms ?? suggestRooms(q.travellers);
    const extraBeds = extraBedsNeeded(q.travellers, rooms);
    const nights = diffDays(q.checkIn, q.checkOut);
    const fetchedAt = this.clock().toISOString();
    const list = (this.catalogue[q.destination] ?? []).filter((h) => !q.types || q.types.includes(h.type));

    return list.map((h) => {
      const subtotal = eachDay(q.checkIn, addDays(q.checkOut, -1)).reduce(
        (s, n) => s + this.nightly(h, q.destination, n, rooms, extraBeds),
        0,
      );
      const total = Math.round(subtotal * TAX);
      const sitePrices: HotelSitePrice[] = h.sites.map((site) => {
        const link = buildDeepLink(site, {
          kind: 'hotel',
          destinationName: place?.name ?? q.destination,
          checkIn: q.checkIn,
          checkOut: q.checkOut,
          travellers: q.travellers,
          rooms,
        });
        return {
          site,
          source: this.id,
          sourceName: SITE_NAMES[site],
          price: { amount: Math.round(total * (0.97 + 0.08 * draw(`${h.hotelId}|${site}|price`))), currency: 'INR' },
          isEstimate: q.travellers.childAges.length > 0,
          fetchedAt,
          bookingUrl: link.url,
          prefilled: link.prefilled,
        };
      });
      const cheapest = sitePrices.reduce((best, s) => (s.price.amount < best.price.amount ? s : best));
      return {
        hotelId: h.hotelId,
        name: h.name,
        type: h.type,
        stars: h.stars,
        guestRating: h.guestRating,
        reviewCount: h.reviewCount,
        lat: h.lat,
        lng: h.lng,
        amenities: h.amenities,
        breakfastIncluded: h.breakfastIncluded,
        freeCancellation: h.freeCancellation,
        nights,
        rooms,
        extraBeds,
        ...(h.restaurant ? { restaurant: h.restaurant } : {}),
        sitePrices,
        cheapest,
      };
    });
  }

  /** Cheapest nightly cost (incl. tax) per night among hotels of this type rated 3.5+. */
  async nightlyGroupPrice(
    destination: string,
    year: number,
    month: number,
    travellers: Travellers,
    type: HotelType,
  ): Promise<Record<ISODate, number>> {
    validateTravellers(travellers);
    const rooms = travellers.rooms ?? suggestRooms(travellers);
    const extraBeds = extraBedsNeeded(travellers, rooms);
    const candidates = (this.catalogue[destination] ?? []).filter((h) => h.type === type && h.guestRating >= MIN_RATING);
    if (candidates.length === 0) return {};
    const out: Record<ISODate, number> = {};
    for (let day = 1; day <= daysInMonth(year, month); day++) {
      const night = isoDate(year, month, day);
      out[night] = Math.round(Math.min(...candidates.map((h) => this.nightly(h, destination, night, rooms, extraBeds))) * TAX);
    }
    return out;
  }
}
