import type {
  AttractionLike,
  CalendarEvent,
  ISODate,
  LocalModeLike,
  MonthClimate,
  PricedOffer,
  RestaurantLike,
  ShopLike,
  Travellers,
} from '@tripsaver/domain';

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
  /** Who the weather comes from, shown next to it (required by e.g. Open-Meteo's CC BY 4.0 licence). Absent for sample data. */
  attribution?: {
    name: string;
    url: string;
    /** Years averaged, e.g. 2021–2025. */ years: { from: number; to: number };
  };
}

/** A sight or experience at a destination (brief §2.3, §3.5). */
export interface Attraction extends AttractionLike {
  destination: string;
  description: string;
  kidFriendly: boolean;
  /** Official ticket booking page, where one exists (brief §3.4). */
  ticketUrl?: string;
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

// ── Destination content (brief §3.6–3.8): curated, with a "last verified on" date ──

export interface Dish {
  id: string;
  name: string;
  description: string;
  /** 'egg' = vegetarian except for egg (eggetarian). */
  vegType: 'veg' | 'egg' | 'non-veg';
  /** Typical price per plate (or per `unit`), rupees. */
  priceMin: number;
  priceMax: number;
  unit?: string;
}

export interface Restaurant extends RestaurantLike {
  name: string;
  area: string;
  hours: string;
  note?: string;
}

export interface Shop extends ShopLike {
  name: string;
  hours: string;
  /** What to buy there, with a typical price where it helps. */
  buy: { item: string; priceMin?: number; priceMax?: number; unit?: string }[];
  /** fixed = fair fixed price; some = a little; hard = start at `bargainStartPct` of the asking price. */
  bargain: 'fixed' | 'some' | 'hard';
  bargainStartPct?: [number, number];
  /** e.g. "GI-tagged Goa cashew". */
  tags: string[];
}

export interface NamedPoint {
  name: string;
  lat: number;
  lng: number;
  phone?: string;
}

export interface DestinationGuide {
  destination: string;
  /** ISO date the content was last checked by a person. */
  lastVerifiedOn: string;
  dishes: Dish[];
  restaurants: Restaurant[];
  shops: Shop[];
  /** Common tourist traps when shopping. */
  traps: string[];
  dos: string[];
  donts: string[];
  emergency: { numbers: { label: string; number: string }[]; hospitals: NamedPoint[]; police: NamedPoint[] };
  network: string;
  atms: string;
  permits: string;
  pack: string[];
}

export interface ContentProvider {
  id: string;
  guide(destination: string): Promise<DestinationGuide | null>;
}

export interface ProviderSet {
  attractions: AttractionsProvider[];
  content: ContentProvider[];
  local: LocalTransportProvider[];
  train: TrainProvider[];
  bus: BusProvider[];
  flight: FlightProvider[];
  hotel: HotelProvider[];
  calendar: CalendarEventsProvider[];
  weather: WeatherProvider[];
  places: PlaceDirectory;
}
