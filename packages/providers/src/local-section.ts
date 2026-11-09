import {
  localFare,
  localMinutes,
  tagLocalOptions,
  type ItineraryDay,
  type LocalLegKind,
  type PlanStyle,
  type Travellers,
} from '@tripsaver/domain';
import type { Clock } from './clock.js';
import { withTimeout } from './dates-section.js';
import type { Attraction, LocalMode, ProviderSet } from './interfaces.js';
import type { LocalLegView, LocalOptionView, LocalSection } from './results-contract.js';

interface RawLeg {
  key: string;
  kind: LocalLegKind;
  dayIndex: number;
  from: string;
  to: string;
  stops: string[];
  /** Attraction ids on a sightseeing day (for the sight-specific extras). */
  attractionIds: string[];
  legsKm: number[];
}

/** The journeys in a day-by-day plan: station → hotel, each sightseeing day, base changes, hotel → station. */
export function legsOf(
  days: ItineraryDay[],
  names: { arrival: string; departure: string; base: (id: string | null) => string },
  attractions: Record<string, Attraction>,
): RawLeg[] {
  const out: RawLeg[] = [];
  let prevBase: string | null = null;
  for (const d of days) {
    const base = names.base(d.baseId);
    const visits = d.stops.filter((s) => s.kind === 'visit');
    for (const s of d.stops) {
      if (s.kind === 'to-hotel')
        out.push({
          key: `${d.index}-arrival`,
          kind: 'arrival',
          dayIndex: d.index,
          from: names.arrival,
          to: base,
          stops: [],
          attractionIds: [],
          legsKm: [s.distanceKm ?? 0],
        });
      if (s.kind === 'move-base')
        out.push({
          key: `${d.index}-move`,
          kind: 'move',
          dayIndex: d.index,
          from: names.base(prevBase),
          to: base,
          stops: [],
          attractionIds: [],
          legsKm: [s.distanceKm ?? 0],
        });
    }
    if (visits.length) {
      const back = d.stops.find((s) => s.kind === 'back-to-hotel');
      out.push({
        key: `${d.index}-day`,
        kind: 'day',
        dayIndex: d.index,
        from: base,
        to: base,
        stops: visits.map((v) => attractions[v.attractionId!]?.name ?? v.attractionId!),
        attractionIds: visits.map((v) => v.attractionId!),
        legsKm: [...visits.map((v) => v.distanceKm ?? 0), ...(back ? [back.distanceKm ?? 0] : [])].filter(
          (k) => k > 0,
        ),
      });
    }
    const toStation = d.stops.find((s) => s.kind === 'to-station');
    if (toStation)
      out.push({
        key: `${d.index}-departure`,
        kind: 'departure',
        dayIndex: d.index,
        from: base,
        to: names.departure,
        stops: [],
        attractionIds: [],
        legsKm: [toStation.distanceKm ?? 0],
      });
    if (d.baseId) prevBase = d.baseId;
  }
  return out.filter((l) => l.legsKm.length > 0);
}

/**
 * Local transport for every journey in the plan (brief §3.3): each option's group fare range, time and
 * where to book; the cheapest, the most convenient and the plan's own choice; plus fixed trips a sight
 * needs. Budget/Offbeat use public transport where it exists, Comfort a cab (PLAN §6.3).
 */
export async function buildLocalSection(
  set: ProviderSet,
  destination: string,
  legs: RawLeg[],
  travellers: Travellers,
  style: PlanStyle,
  opts: { clock: Clock; timeoutMs: number },
): Promise<LocalSection> {
  const [modeLists, tipLists] = await Promise.all([
    Promise.all(
      set.local.map((p) => withTimeout(p.modes(destination), opts.timeoutMs, `${p.id} local modes`)),
    ),
    Promise.all(set.local.map((p) => withTimeout(p.tips(destination), opts.timeoutMs, `${p.id} local tips`))),
  ]);
  const modes: LocalMode[] = modeLists.flat();
  const alternatives = modes.filter((m) => !m.forAttraction);
  const extrasFor = modes.filter((m) => m.forAttraction);

  const views: LocalLegView[] = legs.map((leg) => {
    const priced = alternatives
      .map((m) => {
        const fare = localFare(m, leg.legsKm, travellers, leg.kind);
        return fare ? { m, ...fare, minutes: localMinutes(m, leg.legsKm) } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const tags = tagLocalOptions(
      priced.map((p) => ({
        id: p.m.id,
        public: p.m.public,
        doorToDoor: p.m.doorToDoor,
        min: p.min,
        max: p.max,
        minutes: p.minutes,
      })),
      style,
    );
    const options: LocalOptionView[] = priced
      .map((p) => ({
        id: p.m.id,
        name: p.m.name,
        kind: p.m.kind,
        min: p.min,
        max: p.max,
        minutes: p.minutes,
        public: p.m.public,
        doorToDoor: p.m.doorToDoor,
        booking: p.m.booking,
        ...(p.m.note ? { note: p.m.note } : {}),
        fareSource: p.m.fareSource,
        cheapest: tags.cheapest === p.m.id,
        convenient: tags.convenient === p.m.id,
        inPlan: tags.plan === p.m.id,
      }))
      .sort((a, b) => a.min - b.min);
    const extras = extrasFor
      .filter((m) => leg.kind === 'day' && leg.attractionIds.includes(m.forAttraction!))
      .map((m) => {
        const fare = localFare({ ...m, legKinds: ['day'] }, [0], travellers, 'day')!;
        // Return trip for fixed services (there and back).
        return {
          id: m.id,
          name: m.name,
          attraction: m.forAttraction!,
          min: fare.min * 2,
          max: fare.max * 2,
          booking: m.booking,
          fareSource: m.fareSource,
        };
      });
    const chosen = options.find((o) => o.inPlan);
    const extraMin = extras.reduce((s, e) => s + e.min, 0);
    const extraMax = extras.reduce((s, e) => s + e.max, 0);
    return {
      key: leg.key,
      kind: leg.kind,
      dayIndex: leg.dayIndex,
      from: leg.from,
      to: leg.to,
      stops: leg.stops,
      km: Math.round(leg.legsKm.reduce((s, k) => s + k, 0)),
      options,
      extras,
      plan: { min: (chosen?.min ?? 0) + extraMin, max: (chosen?.max ?? 0) + extraMax },
    };
  });

  return {
    legs: views,
    tips: [...new Set(tipLists.flat())],
    total: { min: views.reduce((s, l) => s + l.plan.min, 0), max: views.reduce((s, l) => s + l.plan.max, 0) },
    source: set.local.map((p) => p.id).join(', '),
    fetchedAt: opts.clock().toISOString(),
  };
}

/** The plan's local-transport spend per day (midpoint of the range), so day spends match this tab. */
export function localSpendByDay(section: LocalSection): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of section.legs)
    out.set(l.dayIndex, (out.get(l.dayIndex) ?? 0) + Math.round((l.plan.min + l.plan.max) / 2));
  return out;
}
