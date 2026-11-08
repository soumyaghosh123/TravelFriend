/** Calendar date in ISO form, `YYYY-MM-DD`. No time, no timezone. */
export type ISODate = string;

/** Money in integer rupees. */
export interface Money {
  amount: number;
  currency: 'INR';
}

export type Mode = 'train' | 'bus' | 'flight' | 'hotel';
export type FareType = 'free' | 'half' | 'full';

export interface Travellers {
  adults: number;
  childAges: number[];
  rooms?: number;
}

/** An age band with its price multiplier. `providerId: null` is the default rule for the mode. */
export interface PricingRule {
  mode: Mode;
  providerId: string | null;
  minAge: number;
  maxAge: number | null;
  multiplier: number;
  fareType: FareType;
}

export interface TravellerPriceLine {
  label: string;
  count: number;
  fareType: FareType;
  unitAmount: number;
  amount: number;
  isEstimate: boolean;
}

export interface GroupPrice {
  total: number;
  lines: TravellerPriceLine[];
  isEstimate: boolean;
}

/** Every price shown to a user carries its source, freshness and a booking link. */
export interface PricedOffer {
  source: string;
  sourceName: string;
  price: Money;
  perPerson?: Money;
  breakdown?: TravellerPriceLine[];
  isEstimate: boolean;
  fetchedAt: string;
  bookingUrl: string;
  prefilled: boolean;
}

export type EventKind = 'festival' | 'holiday' | 'longWeekend' | 'school' | 'season' | 'local';

/** A date range that moves prices. `priceImpact` 1.0 = no change, 1.8 = 80% dearer. */
export interface CalendarEvent {
  name: string;
  start: ISODate;
  end: ISODate;
  kind: EventKind;
  priceImpact: number;
}

/** Typical conditions for a month. `priceIndex` 1.0 = yearly average price. */
export interface MonthClimate {
  month: number;
  priceIndex: number;
  maxC: number;
  minC: number;
  summary: string;
}
