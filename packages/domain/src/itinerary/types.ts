import type { LatLng } from '../hotels/hotels.js';
import type { ISODate } from '../types.js';

export type BestTime = 'morning' | 'afternoon' | 'evening' | 'any';
export type Footfall = 'low' | 'medium' | 'high';

/** What the itinerary engines need from a sight. Times are local `HH:MM`. */
export interface AttractionLike extends LatLng {
  id: string;
  name: string;
  category: string;
  open: string;
  close: string;
  /** 0 = Sunday … 6 = Saturday. */
  closedDays: number[];
  durationMin: number;
  bestTime: BestTime;
  /** Per adult, rupees. */
  entryFee: number;
  rating: number;
  footfall: Footfall;
  isOffbeat: boolean;
  /** A must-see for the destination. */
  isHighlight: boolean;
  warnings?: { road?: string; network?: string; permit?: string };
}

/** A candidate base (where you sleep) for a destination. */
export interface BaseCandidate extends LatLng {
  id: string;
  name: string;
}

export interface BaseStay extends BaseCandidate {
  nights: number;
  /** First night at this base. */
  checkIn: ISODate;
}

export interface ItineraryLimits {
  dayStart: string;
  /** Latest time a visit may end. */
  dayEnd: string;
  /** Active minutes (visits + local travel): middle days, arrival day, departure day. */
  middleMin: number;
  arrivalMin: number;
  departureMin: number;
  maxStops: number;
  /** Average local road speed and per-leg overhead (parking, waiting). */
  speedKmh: number;
  legOverheadMin: number;
  /** Time to reach the station/airport before the return departs. */
  departureBufferMin: number;
}

export const DEFAULT_LIMITS: ItineraryLimits = {
  dayStart: '09:00',
  dayEnd: '20:30',
  middleMin: 9 * 60,
  arrivalMin: 4 * 60,
  departureMin: 3 * 60,
  maxStops: 4,
  speedKmh: 40,
  legOverheadMin: 10,
  departureBufferMin: 120,
};

export type DayKind = 'travel' | 'arrival' | 'sightseeing' | 'transfer' | 'free' | 'departure';
export type Slot = 'morning' | 'afternoon' | 'evening' | 'night';

export type StopKind = 'journey' | 'to-hotel' | 'check-in' | 'check-out' | 'move-base' | 'visit' | 'back-to-hotel' | 'to-station' | 'free';

export interface ItineraryStop {
  kind: StopKind;
  slot: Slot;
  start: string;
  durationMin: number;
  /** Counts towards the day's active hours. */
  active: boolean;
  attractionId?: string;
  /** For visits: minutes travelling there from the previous stop (active). */
  travelMin?: number;
  /** Road distance estimate: the leg itself, or the leg before a visit. */
  distanceKm?: number;
}

export interface ItineraryDay {
  index: number;
  date: ISODate;
  kind: DayKind;
  /** Base you are at (or arrive at) that day; null while travelling. */
  baseId: string | null;
  stops: ItineraryStop[];
  activeMin: number;
  /** Where the night is spent: a base id, on the train/bus, or home. */
  nightAt: string | 'transit' | 'home';
}

export interface ItineraryInput {
  start: ISODate;
  days: number;
  /** Local date-times `YYYY-MM-DDTHH:MM`: onward arrival at the destination, return departure. */
  arrive: string;
  leave: string;
  /** When the return journey gets home; days after it are at home, before it in transit. */
  home?: string;
  arrivalPoint: LatLng;
  bases: BaseStay[];
  attractions: AttractionLike[];
  limits?: Partial<ItineraryLimits>;
}

export interface Itinerary {
  days: ItineraryDay[];
  /** Selected sights that didn't fit (shown as "if you have time"). */
  unscheduled: string[];
  limits: ItineraryLimits;
}
