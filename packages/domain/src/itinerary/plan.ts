import { addDays, dayOfWeek, diffDays, eachDay } from '../dates.js';
import { distanceKm, type LatLng } from '../hotels/hotels.js';
import type { ISODate } from '../types.js';
import { nearestBase } from './bases.js';
import {
  DEFAULT_LIMITS,
  type AttractionLike,
  type BaseStay,
  type Itinerary,
  type ItineraryDay,
  type ItineraryInput,
  type ItineraryLimits,
  type ItineraryStop,
  type Slot,
} from './types.js';
import { validateItinerary } from './validate.js';

/** Roads are longer than the straight line. */
export const ROAD_FACTOR = 1.3;
const CHECK_IN_MIN = 30;
const CHECK_OUT_MIN = 20;
/** Sunset spots, night markets and the like start no earlier than this. */
const EVENING_FROM = 16 * 60 + 30;
/** Morning-best sights must start by this. */
const MORNING_UNTIL = 11 * 60 + 30;
/** With no sights left to fit before 15:00, evening sights may be waited for. */
const AFTERNOON_FROM = 15 * 60;
/** Arriving later than this leaves just enough for checking in. */
const LATE_ARRIVAL = 18 * 60;

export const toMin = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const fromMin = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function slotOf(min: number): Slot {
  if (min < 12 * 60) return 'morning';
  if (min < 17 * 60) return 'afternoon';
  if (min < 21 * 60) return 'evening';
  return 'night';
}

export function roadKm(a: LatLng, b: LatLng): number {
  return Math.round(distanceKm(a, b) * ROAD_FACTOR * 10) / 10;
}

export function travelMinutes(a: LatLng, b: LatLng, l: ItineraryLimits): number {
  const km = roadKm(a, b);
  return km < 0.3 ? 0 : Math.round((km / l.speedKmh) * 60) + l.legOverheadMin;
}

/** Days per week a sight is open; 1–2 means "go on its day" (weekly markets). */
function openDays(a: AttractionLike): number {
  return 7 - a.closedDays.length;
}

interface RouteArgs {
  date: ISODate;
  from: LatLng;
  /** Where the day ends: the hotel, or the station on departure day. */
  returnTo: LatLng;
  t: number;
  /** Sightseeing minutes available (visits, legs between them, and the leg back). */
  budget: number;
  deadline: number;
  pool: Set<string>;
  byId: Map<string, AttractionLike>;
  l: ItineraryLimits;
}

/** Nearest-neighbour route (PLAN §6.5 step 3) honouring opening hours, closed days and best time of day. */
function route(r: RouteArgs): { stops: ItineraryStop[]; used: number; t: number; pos: LatLng } {
  const stops: ItineraryStop[] = [];
  let { t } = r;
  let pos = r.from;
  let used = 0;
  const weekday = dayOfWeek(r.date);

  for (;;) {
    if (stops.length >= r.l.maxStops) break;
    const feasible: { a: AttractionLike; travel: number; start: number; km: number }[] = [];
    for (const id of r.pool) {
      const a = r.byId.get(id)!;
      if (a.closedDays.includes(weekday)) continue;
      const travel = travelMinutes(pos, a, r.l);
      const start = Math.max(t + travel, toMin(a.open), a.bestTime === 'evening' ? EVENING_FROM : 0);
      const end = start + a.durationMin;
      if (end > toMin(a.close) || end > r.deadline) continue;
      if (a.bestTime === 'morning' && start > MORNING_UNTIL) continue;
      if (used + travel + a.durationMin + travelMinutes(a, r.returnTo, r.l) > r.budget) continue;
      feasible.push({ a, travel, start, km: roadKm(pos, a) });
    }
    if (feasible.length === 0) break;

    let pick = feasible;
    const scarce = pick.filter((f) => openDays(f.a) <= 2);
    if (scarce.length) pick = scarce;
    else if (t < AFTERNOON_FROM) {
      const notEvening = pick.filter((f) => f.a.bestTime !== 'evening');
      if (notEvening.length) pick = notEvening;
    }
    const best = pick.sort((x, y) => x.travel - y.travel || (x.a.id < y.a.id ? -1 : 1))[0]!;

    stops.push({
      kind: 'visit',
      slot: slotOf(best.start),
      start: fromMin(best.start),
      durationMin: best.a.durationMin,
      active: true,
      attractionId: best.a.id,
      travelMin: best.travel,
      distanceKm: best.km,
    });
    r.pool.delete(best.a.id);
    used += best.travel + best.a.durationMin;
    t = best.start + best.a.durationMin;
    pos = best.a;
  }
  return { stops, used, t, pos };
}

function travelStop(kind: ItineraryStop['kind'], start: number, from: LatLng, to: LatLng, l: ItineraryLimits): ItineraryStop {
  return { kind, slot: slotOf(start), start: fromMin(start), durationMin: travelMinutes(from, to, l), active: true, distanceKm: roadKm(from, to) };
}

function fixed(kind: ItineraryStop['kind'], start: number, durationMin: number, active: boolean): ItineraryStop {
  return { kind, slot: slotOf(start), start: fromMin(start), durationMin, active };
}

export function activeMinutes(stops: ItineraryStop[]): number {
  return stops.reduce((s, x) => s + (x.active ? x.durationMin : 0) + (x.travelMin ?? 0), 0);
}

/** Visits, the legs between them and the leg back: what the light-day caps measure. */
export function sightMinutesOf(stops: ItineraryStop[]): number {
  return stops.reduce(
    (s, x) => s + (x.kind === 'visit' ? x.durationMin + (x.travelMin ?? 0) : x.kind === 'back-to-hotel' ? x.durationMin : 0),
    0,
  );
}

/** Which base a night (or a morning) belongs to. */
function baseOn(bases: BaseStay[], date: ISODate): BaseStay | undefined {
  return bases.find((b) => date >= b.checkIn && date < addDays(b.checkIn, b.nights)) ?? bases.at(-1);
}

/**
 * ItineraryEngine (PLAN §6.5, brief §3.5). Builds N days:
 * travel days before arrival and after the return leaves; a light arrival day (≤ 4 sightseeing hours);
 * a light departure day (≤ 3); middle days ≤ 9 active hours; a transfer day when the base changes;
 * one free day on trips over 7 days. Sights go to their nearest base and are routed nearest-neighbour.
 * The result is validated against every rule; a violation throws (it would be a bug).
 */
export function planItinerary(input: ItineraryInput): Itinerary {
  const l: ItineraryLimits = { ...DEFAULT_LIMITS, ...input.limits };
  const byId = new Map(input.attractions.map((a) => [a.id, a]));
  const arriveDate = input.arrive.slice(0, 10);
  const arriveAt = toMin(input.arrive.slice(11, 16));
  const leaveDate = input.leave.slice(0, 10);
  const leaveAt = toMin(input.leave.slice(11, 16));
  const homeDate = input.home?.slice(0, 10) ?? leaveDate;
  const dates = eachDay(input.start, addDays(input.start, input.days - 1));
  const bases = input.bases;
  const departurePoint = input.departurePoint ?? input.arrivalPoint;

  // Each sight belongs to its nearest base.
  const pools = new Map(bases.map((b) => [b.id, new Set<string>()]));
  for (const a of input.attractions) {
    const b = nearestBase(a, bases);
    if (b) pools.get(b.id)!.add(a.id);
  }

  // Trips over 7 days get one free day: the plain sightseeing day closest to the middle (PLAN §6.5).
  let freeDate: ISODate | null = null;
  if (input.days > 7) {
    const plain = dates.filter((d) => d > arriveDate && d < leaveDate && !bases.slice(1).some((b) => b.checkIn === d));
    const mid = (input.days - 1) / 2;
    freeDate = [...plain].sort((a, b) => Math.abs(dates.indexOf(a) - mid) - Math.abs(dates.indexOf(b) - mid) || (a < b ? -1 : 1))[0] ?? null;
  }

  const days: ItineraryDay[] = dates.map((date, i): ItineraryDay => {
    const index = i + 1;
    const nightBase = date >= arriveDate && date < leaveDate ? baseOn(bases, date) : undefined;
    const nightAt = nightBase ? nightBase.id : date >= homeDate && date >= leaveDate ? 'home' : 'transit';
    const make = (kind: ItineraryDay['kind'], baseId: string | null, stops: ItineraryStop[]): ItineraryDay => ({
      index,
      date,
      kind,
      baseId,
      stops,
      activeMin: activeMinutes(stops),
      nightAt,
    });

    if (date < arriveDate || date > leaveDate) return make('travel', null, [fixed('journey', i === 0 || date > leaveDate ? toMin(l.dayStart) : 0, 0, false)]);

    if (date === arriveDate && date !== leaveDate) {
      const base = bases[0]!;
      const stops: ItineraryStop[] = [];
      const toHotel = travelStop('to-hotel', arriveAt, input.arrivalPoint, base, l);
      stops.push(toHotel);
      const t = arriveAt + toHotel.durationMin;
      stops.push(fixed('check-in', t, CHECK_IN_MIN, true));
      const after = t + CHECK_IN_MIN;
      if (after < LATE_ARRIVAL) {
        const r = route({ date, from: base, returnTo: base, t: Math.max(after, toMin(l.dayStart)), budget: l.arrivalMin, deadline: toMin(l.dayEnd), pool: pools.get(base.id)!, byId, l });
        stops.push(...r.stops);
        if (r.stops.length) stops.push(travelStop('back-to-hotel', r.t, r.pos, base, l));
      }
      return make('arrival', base.id, stops);
    }

    if (date === leaveDate) {
      const base = bases.at(-1);
      const stops: ItineraryStop[] = [];
      if (!base) {
        // Same-day return: nothing booked at the destination; just the journey back.
        stops.push(fixed('journey', leaveAt, 0, false));
        return make('departure', null, stops);
      }
      const start = toMin(l.dayStart);
      const toStation = travelMinutes(base, departurePoint, l);
      const latestCheckout = leaveAt - l.departureBufferMin - toStation - CHECK_OUT_MIN;
      const checkoutAt = Math.max(0, Math.min(start, latestCheckout));
      stops.push(fixed('check-out', checkoutAt, CHECK_OUT_MIN, true));
      let t = checkoutAt + CHECK_OUT_MIN;
      let pos: LatLng = base;
      if (latestCheckout > start) {
        // Sights must leave time to reach the station: route towards it.
        const r = route({ date, from: base, returnTo: departurePoint, t, budget: l.departureMin, deadline: leaveAt - l.departureBufferMin, pool: pools.get(base.id)!, byId, l });
        // The leg to the station is the journey home, not sightseeing; drop sights that would make us late.
        while (r.stops.length && toMin(r.stops.at(-1)!.start) + r.stops.at(-1)!.durationMin + travelMinutes(byId.get(r.stops.at(-1)!.attractionId!)!, departurePoint, l) > leaveAt - l.departureBufferMin) {
          const dropped = r.stops.pop()!;
          pools.get(base.id)!.add(dropped.attractionId!);
        }
        stops.push(...r.stops);
        if (r.stops.length) {
          const last = byId.get(r.stops.at(-1)!.attractionId!)!;
          t = toMin(r.stops.at(-1)!.start) + r.stops.at(-1)!.durationMin;
          pos = last;
        }
      }
      const toStationStart = Math.max(t, leaveAt - l.departureBufferMin - travelMinutes(pos, departurePoint, l));
      stops.push(travelStop('to-station', toStationStart, pos, departurePoint, l));
      return make('departure', base.id, stops);
    }

    const base = baseOn(bases, date)!;
    if (date === freeDate) return make('free', base.id, [fixed('free', toMin(l.dayStart), 0, false)]);

    const stops: ItineraryStop[] = [];
    let t = toMin(l.dayStart);
    let budget = l.middleMin;
    const prev = bases[bases.indexOf(base) - 1];
    const transfer = prev && base.checkIn === date;
    if (transfer) {
      stops.push(fixed('check-out', t, CHECK_OUT_MIN, true));
      t += CHECK_OUT_MIN;
      const move = travelStop('move-base', t, prev, base, l);
      stops.push(move);
      t += move.durationMin;
      stops.push(fixed('check-in', t, CHECK_IN_MIN, true));
      t += CHECK_IN_MIN;
      budget -= CHECK_OUT_MIN + move.durationMin + CHECK_IN_MIN;
    }
    if (budget > 0) {
      const r = route({ date, from: base, returnTo: base, t, budget, deadline: toMin(l.dayEnd), pool: pools.get(base.id)!, byId, l });
      stops.push(...r.stops);
      if (r.stops.length) stops.push(travelStop('back-to-hotel', r.t, r.pos, base, l));
    }
    return make(transfer ? 'transfer' : 'sightseeing', base.id, stops);
  });

  const scheduled = new Set(days.flatMap((d) => d.stops.map((s) => s.attractionId).filter(Boolean)));
  const itinerary: Itinerary = { days, unscheduled: input.attractions.filter((a) => !scheduled.has(a.id)).map((a) => a.id), limits: l };
  validateItinerary(itinerary, input);
  return itinerary;
}

/** Hotel nights = nights actually spent at the destination (PLAN A1). */
export function hotelNights(arrive: string, leave: string): number {
  return Math.max(0, diffDays(arrive.slice(0, 10), leave.slice(0, 10)));
}
