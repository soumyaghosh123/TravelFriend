import type { PlanStyle } from '../dates-engine/local-estimate.js';
import { groupEntryFee } from '../itinerary/spend.js';
import type { Travellers } from '../types.js';

export type LocalKind =
  | 'app-cab'
  | 'prepaid-taxi'
  | 'taxi'
  | 'taxi-day'
  | 'auto'
  | 'scooter'
  | 'self-drive'
  | 'bus'
  | 'metro'
  | 'ferry'
  | 'shared-jeep'
  | 'jeep-safari';

/** Which journeys a mode serves: station/airport ↔ hotel, a day of sightseeing, or moving base. */
export type LocalLegKind = 'arrival' | 'departure' | 'move' | 'day';

export type LocalPricing =
  /** A whole vehicle (cab, taxi, auto): base + per km, per vehicle. */
  | { type: 'vehicle-km'; base: number; perKm: number; minFare?: number }
  /** A seat (bus, shared jeep, metro): base + per km per adult; children by the default bands. */
  | { type: 'seat-km'; base: number; perKm: number }
  /** A fixed fare per adult (ferry, safari seat); 0 for free services. */
  | { type: 'flat'; perPerson: number }
  /**
   * Hire for the day (taxi for the day, scooter rental), per vehicle. A taxi package includes
   * `includedKm`; each km beyond it costs `extraPerKm` per vehicle.
   */
  | { type: 'day'; perVehicleDay: number; includedKm?: number; extraPerKm?: number };

/** What the local-transport engines need from a mode (brief §3.3). */
export interface LocalModeLike {
  id: string;
  kind: LocalKind;
  /** People per vehicle (1 for seat-priced modes). */
  capacity: number;
  pricing: LocalPricing;
  speedKmh: number;
  /** Average wait or boarding time per leg. */
  waitMin: number;
  public: boolean;
  doorToDoor: boolean;
  /** Fare spread for the shown range (0.1 = ±10%). */
  spread: number;
  /** Defaults to every kind except 'day' pricing, which only serves sightseeing days. */
  legKinds?: LocalLegKind[];
  /** Autos and the like don't do long trips. */
  maxLegKm?: number;
}

/** Seats taken in a vehicle: children under 8 count as half (they share or sit on a lap). */
function occupants(t: Travellers): number {
  return t.adults + t.childAges.reduce((s, a) => s + (a >= 8 ? 1 : 0.5), 0);
}

function serves(m: LocalModeLike, kind: LocalLegKind): boolean {
  const kinds = m.legKinds ?? (m.pricing.type === 'day' ? ['day'] : ['arrival', 'departure', 'move', 'day']);
  return kinds.includes(kind);
}

/**
 * Group fare range for a set of legs (one leg for a transfer; all of a day's legs for a sightseeing day),
 * or null when the mode doesn't serve this kind of journey or a leg is too long for it.
 */
export function localFare(m: LocalModeLike, legsKm: number[], t: Travellers, kind: LocalLegKind): { min: number; max: number } | null {
  if (!serves(m, kind) || legsKm.length === 0) return null;
  if (m.maxLegKm !== undefined && legsKm.some((k) => k > m.maxLegKm!)) return null;
  const vehicles = Math.ceil(occupants(t) / Math.max(1, m.capacity));
  const p = m.pricing;
  let fare: number;
  switch (p.type) {
    case 'vehicle-km':
      fare = legsKm.reduce((s, km) => s + Math.max(p.base + p.perKm * km, p.minFare ?? 0), 0) * vehicles;
      break;
    case 'seat-km':
      fare = legsKm.reduce((s, km) => s + groupEntryFee(Math.round(p.base + p.perKm * km), t), 0);
      break;
    case 'flat':
      fare = groupEntryFee(p.perPerson, t) * legsKm.length;
      break;
    case 'day': {
      const totalKm = legsKm.reduce((s, km) => s + km, 0);
      const extraKm = p.includedKm !== undefined ? Math.max(0, totalKm - p.includedKm) : 0;
      fare = (p.perVehicleDay + extraKm * (p.extraPerKm ?? 0)) * vehicles;
      break;
    }
  }
  return { min: Math.round(fare * (1 - m.spread)), max: Math.round(fare * (1 + m.spread)) };
}

/** Moving time at the mode's speed plus its wait, per leg. */
export function localMinutes(m: LocalModeLike, legsKm: number[]): number {
  return legsKm.reduce((s, km) => s + Math.round((km / m.speedKmh) * 60) + m.waitMin, 0);
}

export interface PricedLocal {
  id: string;
  public: boolean;
  doorToDoor: boolean;
  min: number;
  max: number;
  minutes: number;
}

/**
 * Cheapest (lowest fare), most convenient (door to door, then fastest) and the plan's choice (PLAN §6.3):
 * Budget and Offbeat take the cheapest public option where one exists; Comfort takes the most convenient.
 */
export function tagLocalOptions(priced: PricedLocal[], style: PlanStyle): { cheapest?: string; convenient?: string; plan?: string } {
  if (priced.length === 0) return {};
  const by = <T>(xs: T[], ...keys: ((x: T) => number)[]) =>
    [...xs].sort((a, b) => keys.reduce((d, k) => d || k(a) - k(b), 0))[0];
  const cheapest = by(priced, (p) => p.min, (p) => p.minutes)!;
  const doorToDoor = priced.filter((p) => p.doorToDoor);
  const convenient = by(doorToDoor.length ? doorToDoor : priced, (p) => p.minutes, (p) => p.min)!;
  const publicOnes = priced.filter((p) => p.public);
  const plan = style === 'comfort' ? convenient : (by(publicOnes, (p) => p.min, (p) => p.minutes) ?? cheapest);
  return { cheapest: cheapest.id, convenient: convenient.id, plan: plan.id };
}
