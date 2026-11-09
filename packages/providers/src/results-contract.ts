import type {
  CalendarEvent,
  DateWindow,
  MonthAlternative,
  MonthClimate,
  MonthComparison,
  PeakWarning,
  PriceLevel,
  DaySpend,
  ItineraryDay,
  ItineraryLimits,
  LocalLegKind,
  WindowReason,
} from '@tripsaver/domain';
import type { PricedWindow, TripStyle } from './assemble.js';
import type { Attraction, DestinationGuide, HotelOffer, LocalMode, TransportOffer } from './interfaces.js';

/** API ↔ web contract for the "Best dates & price calendar" section (SSE event `dates`). */

export interface CalendarCell {
  start: string;
  end: string;
  feasible: boolean;
  /** Estimate: cheapest transport each way + cheapest suitable hotel each night + local estimate. */
  total: number;
  band: DateWindow['band'];
}

export interface RankedPricedWindow extends PricedWindow {
  rank: number;
  /** Against the most expensive window, both priced with real offers. */
  saving: number;
  reasons: WindowReason[];
}

export interface StyleDates {
  style: TripStyle;
  cells: CalendarCell[];
  top: RankedPricedWindow[];
  mostExpensive: (PricedWindow & { reasons: WindowReason[] }) | null;
  localPerDay: number;
  /** Sites whose prices built the calendar estimates. */
  sources: string[];
  fetchedAt: string;
}

export interface DatesSection {
  year: number;
  month: number;
  days: number;
  styles: StyleDates[];
  events: CalendarEvent[];
  months: MonthComparison[];
  /** Cheapest nearby month that can still be booked (domain `nearbyCheaperMonth`). */
  bestAlternative: MonthAlternative | null;
  peakWarning: PeakWarning | null;
  climate: MonthClimate | null;
  bookingAdvice: { advanceDays: number; tatkalAcOpens: string; tatkalNonAcOpens: string } | null;
}

export interface WindowDetail {
  window: PricedWindow;
  /** The calendar's estimate for the same start date, for comparison. */
  estimate: number;
  reasons: WindowReason[];
}

// ── "Getting there" section (SSE event `transport`, and GET /api/search/:id/transport) ──

/** One train / bus / flight departure, with an offer per class (cheapest first). */
export interface TransportService {
  key: string;
  mode: TransportOffer['mode'];
  operator: string;
  number?: string;
  fromPoint: string;
  toPoint: string;
  departAt: string;
  arriveAt: string;
  durationMin: number;
  offers: TransportOffer[];
}

/** Two legs via a hub, e.g. train to Hyderabad then an overnight bus to Goa. */
export interface CombinedRoute {
  key: string;
  via: { code: string; name: string };
  first: TransportOffer;
  second: TransportOffer;
  groupFare: number;
  durationMin: number;
  waitMin: number;
}

export interface DirectionTransport {
  from: { code: string; name: string };
  to: { code: string; name: string };
  date: string;
  services: TransportService[];
  summary: { cheapest?: TransportOffer; fastest?: TransportOffer; overnight?: TransportOffer };
  combined: CombinedRoute[];
  /** Modes with no direct service on this date (e.g. no direct bus Kolkata → Goa). */
  noDirect: TransportOffer['mode'][];
  fetchedAt: string;
}

export interface TransportSection {
  onward: DirectionTransport;
  return: DirectionTransport;
  /** True when every fare comes from a mock provider, so the UI labels timings and fares as sample data. */
  sampleData: boolean;
}

// ── "Hotels" section (SSE event `hotels`, and GET /api/search/:id/hotels) ──

/** A hotel for the stay, with what the filters and sorts need (domain `HotelLike`). */
export interface HotelListing extends HotelOffer {
  /** From the landmark the user asked to stay near (or the destination's main area). */
  distanceKm: number | null;
  /** Cheapest site's total for the stay, all rooms, incl. taxes. */
  totalPrice: number;
  perNight: number;
}

export interface HotelsSection {
  destination: { code: string; name: string };
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  extraBeds: number;
  /** `matched` is false when we fell back to the main area because "Stay near" was empty or unknown. */
  landmark: { name: string; matched: boolean } | null;
  hotels: HotelListing[];
  priceHint: PriceLevel | null;
  sampleData: boolean;
  fetchedAt: string;
}

// ── "Day-by-day plan" section (SSE event `itinerary`, and GET /api/search/:id/itinerary) ──

export interface PlannedDay extends ItineraryDay {
  /** Estimated spend for the group (entry fees, local travel, meals); always approx. */
  spend: DaySpend;
}

/** Where you sleep, for how long, and in which hotel (the plan's choice and a 5★ option). */
export interface PlanBase {
  id: string;
  name: string;
  lat: number;
  lng: number;
  nights: number;
  checkIn: string;
  hotel: HotelListing | null;
  /** Price for this base's nights: exact for a single base, estimated (per night × nights) when the stay is split. */
  hotelTotal: number | null;
  hotelTotalIsEstimate: boolean;
  fiveStar: HotelListing | null;
}

/** What "How this plan was checked" shows: the hard rules with the actual numbers. */
export interface ItineraryChecks {
  days: number;
  busiest: { index: number; activeMin: number };
  /** Scheduled sights that have closed days, and the days they are shut. */
  closedDays: { name: string; closedDays: number[] }[];
  freeDay: number | null;
  first: { kind: ItineraryDay['kind']; sightMin: number };
  last: { kind: ItineraryDay['kind']; sightMin: number };
  nightsAtBases: number;
}

export type ItinerarySection =
  | {
      style: TripStyle;
      available: true;
      start: string;
      end: string;
      days: PlannedDay[];
      bases: PlanBase[];
      /** The plan's sights by id (scheduled and unscheduled). */
      attractions: Record<string, Attraction>;
      unscheduled: string[];
      arrivalPoint: string;
      departurePoint: string;
      checks: ItineraryChecks;
      limits: ItineraryLimits;
      local: LocalSection;
      sampleData: boolean;
      fetchedAt: string;
    }
  | {
      style: TripStyle;
      available: false;
      reason: 'noOffbeat';
      nearestAlternative: {
        name: string;
        destination: string;
        destinationName: string;
        distanceKm: number;
      } | null;
    };

// ── "Local transport" (part of the itinerary section, so day spends and this tab agree) ──

export interface LocalOptionView {
  id: string;
  name: string;
  kind: LocalMode['kind'];
  /** Group fare range for this leg (or the whole day), approx. */
  min: number;
  max: number;
  minutes: number;
  public: boolean;
  doorToDoor: boolean;
  booking: LocalMode['booking'];
  note?: string;
  cheapest: boolean;
  convenient: boolean;
  /** The option the plan uses (and counts in the day's spend). */
  inPlan: boolean;
}

export interface LocalLegView {
  key: string;
  kind: LocalLegKind;
  dayIndex: number;
  from: string;
  to: string;
  /** Sights on a sightseeing day, in order. */
  stops: string[];
  km: number;
  options: LocalOptionView[];
  /** Fixed trips a sight needs (Divar ferry, Dudhsagar jeep), added to the day. */
  extras: {
    id: string;
    name: string;
    attraction: string;
    min: number;
    max: number;
    booking: LocalMode['booking'];
  }[];
  /** The plan's option + extras. */
  plan: { min: number; max: number };
}

export interface LocalSection {
  legs: LocalLegView[];
  tips: string[];
  total: { min: number; max: number };
  source: string;
  fetchedAt: string;
}

// ── Destination guide: sights, food, shopping, do's & don'ts (SSE event `guide`, GET /api/destinations/:code/guide) ──

/**
 * Content for one destination. Distances depend on where you stay, so the web app measures them from
 * the plan's hotel with the pure `groupSights` / `rankRestaurants` / `splitShops` / `nearestTo` engines.
 */
export interface GuideSection {
  destination: { code: string; name: string; kind: 'city' | 'region' };
  /** Where distances are measured from when there is no plan hotel (guide pages, Offbeat with no plan). */
  mainArea: { name: string; lat: number; lng: number };
  /** Local road speed, for travel times. */
  speedKmh: number;
  sights: Attraction[];
  /** Null when no content provider covers the destination yet. */
  guide: DestinationGuide | null;
  sampleData: boolean;
  source: string;
  fetchedAt: string;
}
