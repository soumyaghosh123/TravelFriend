import type {
  CalendarEvent,
  DateWindow,
  MonthAlternative,
  MonthClimate,
  MonthComparison,
  PeakWarning,
  PriceLevel,
  WindowReason,
} from '@tripsaver/domain';
import type { PricedWindow, TripStyle } from './assemble.js';
import type { HotelOffer, TransportOffer } from './interfaces.js';

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
