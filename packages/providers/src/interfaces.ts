import type { AttractionLike, CalendarEvent, ISODate, LocalModeLike, MonthClimate, PricedOffer, Travellers } from '@tripsaver/domain';

export interface Place {
  code: string;
  name: string;
  kind: 'city' | 'region';
  stations: string[];
  airports: string[];
  busPoints: string[];
  lat: number;
  lng: number;
  /** Typical local road speed (km/h) for itinerary travel times: slower in the hills. */
  localSpeedKmh?: number;
  /** Where you arrive by each mode (station, airport, bus stand), for timing the transfer to the hotel. */
  gateways?: Partial<Record<'train' | 'bus' | 'flight', { name: string; lat: number; lng: number }>>;
}

/** A named spot to stay near (beach, old town, mall road); the first per destination is its main area. */
export interface Landmark {
  name: string;
  lat: number;
  lng: number;
  /** A place to base yourself for a few nights (BaseSplitter candidates, PLAN §6.4). */
  isBase?: boolean;
}

export interface PlaceDirectory {
  places(): Place[];
  get(code: string): Place | undefined;
  landmarks(code: string): Landmark[];
}

/** `from` / `to` are `Place.code`s. */
export interface RouteQuery {
  from: string;
  to: string;
  date: ISODate;
  travellers: Travellers;
}

export interface TransportOffer extends PricedOffer {
  mode: 'train' | 'bus' | 'flight';
  operator: string;
  number?: string;
  travelClass: string;
  departAt: string;
  arriveAt: string;
  departDate: ISODate;
  arriveDate: ISODate;
  durationMin: number;
  availability?: string;
  confirmChancePct?: number;
  fromPoint: string;
  toPoint: string;
}

export interface FareGridQuery {
  from: string;
  to: string;
  year: number;
  month: number;
  travellers: Travellers;
  classes?: string[];
}

export interface TransportProvider {
  id: string;
  name: string;
  mode: 'train' | 'bus' | 'flight';
  search(q: RouteQuery): Promise<TransportOffer[]>;
  cheapestByDate(q: FareGridQuery): Promise<Record<ISODate, TransportOffer | undefined>>;
}

export interface TrainProvider extends TransportProvider {
  mode: 'train';
  bookingWindow(): { advanceDays: number; tatkalAcOpens: string; tatkalNonAcOpens: string };
}

export type BusProvider = TransportProvider & { mode: 'bus' };
export type FlightProvider = TransportProvider & { mode: 'flight' };

export type HotelType = 'budget' | '3star' | '4star' | '5star' | 'homestay' | 'resort' | 'hostel';

export interface HotelQuery {
  destination: string;
  checkIn: ISODate;
  checkOut: ISODate;
  travellers: Travellers;
  types?: HotelType[];
}

export interface HotelSitePrice extends PricedOffer {
  site: string;
}

export interface HotelOffer {
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
  nights: number;
  rooms: number;
  /** Extra beds included in the price (more than 2 adult-priced guests per room). */
  extraBeds: number;
  /** The hotel's own restaurant, where known (brief §3.1). */
  restaurant?: { costForTwo: number; breakfastPerPerson?: number };
  sitePrices: HotelSitePrice[];
  cheapest: HotelSitePrice;
}

export interface HotelProvider {
  id: string;
  name: string;
  search(q: HotelQuery): Promise<HotelOffer[]>;
  nightlyGroupPrice(
    destination: string,
    year: number,
    month: number,
    travellers: Travellers,
    type: HotelType,
  ): Promise<Record<ISODate, number>>;
}

export interface CalendarEventsProvider {
  id: string;
  events(destination: string, year: number, month: number): Promise<CalendarEvent[]>;
}

export interface WeatherProvider {
  id: string;
  climate(destination: string): Promise<MonthClimate[]>;
}

/** A sight or experience at a destination (brief §2.3, §3.5). */
export interface Attraction extends AttractionLike {
  destination: string;
  description: string;
  kidFriendly: boolean;
}

export interface AttractionsProvider {
  id: string;
  attractions(destination: string): Promise<Attraction[]>;
}

/** A way of getting around at the destination (brief §3.3), with where to book it. */
export interface LocalMode extends LocalModeLike {
  name: string;
  booking: {
    type: 'app' | 'counter' | 'pay-on-board' | 'rental-shop' | 'hotel-desk';
    /** Where to book or board, e.g. "Prepaid counter at the station exit". */
    where: string;
    url?: string;
    phone?: string;
  };
  note?: string;
  /** Needed to reach one particular sight (the Divar ferry, the Dudhsagar jeep): added to that day, not an alternative. */
  forAttraction?: string;
}

export interface LocalTransportProvider {
  id: string;
  modes(destination: string): Promise<LocalMode[]>;
  /** Things to know, e.g. "Uber and Ola don't operate in Goa". */
  tips(destination: string): Promise<string[]>;
}

export interface ProviderSet {
  attractions: AttractionsProvider[];
  local: LocalTransportProvider[];
  train: TrainProvider[];
  bus: BusProvider[];
  flight: FlightProvider[];
  hotel: HotelProvider[];
  calendar: CalendarEventsProvider[];
  weather: WeatherProvider[];
  places: PlaceDirectory;
}
