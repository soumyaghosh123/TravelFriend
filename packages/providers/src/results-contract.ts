import type {
  CalendarEvent,
  DateWindow,
  MonthAlternative,
  MonthClimate,
  MonthComparison,
  PeakWarning,
  WindowReason,
} from '@tripsaver/domain';
import type { PricedWindow, TripStyle } from './assemble.js';

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
