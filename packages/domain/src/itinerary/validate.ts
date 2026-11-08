import { addDays, dayOfWeek, diffDays } from '../dates.js';
import type { Itinerary, ItineraryInput } from './types.js';

/** An itinerary broke one of the hard rules. This is a bug, never a user error (PLAN §6.5 step 5). */
export class ItineraryRuleError extends Error {
  constructor(
    readonly rule: string,
    detail: string,
  ) {
    super(`Itinerary rule "${rule}" broken: ${detail}`);
    this.name = 'ItineraryRuleError';
  }
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Visits + legs between them + the leg back (the light-day caps). */
function sightMin(d: Itinerary['days'][number]): number {
  return d.stops.reduce(
    (s, x) => s + (x.kind === 'visit' ? x.durationMin + (x.travelMin ?? 0) : x.kind === 'back-to-hotel' ? x.durationMin : 0),
    0,
  );
}

/**
 * Hard rules (CLAUDE.md rule 3, brief §3.5, PLAN A1):
 * N distinct consecutive days · ≤ 9 active hours a day · no sight on its closed day or outside its hours ·
 * no sight twice · Day 1 and Day N light · hotel nights = nights at the destination · a free day when N > 7.
 */
export function validateItinerary(it: Itinerary, input: ItineraryInput): void {
  const l = it.limits;
  const byId = new Map(input.attractions.map((a) => [a.id, a]));
  const fail = (rule: string, detail: string): never => {
    throw new ItineraryRuleError(rule, detail);
  };

  if (it.days.length !== input.days) fail('days', `${it.days.length} days for a ${input.days}-day trip`);
  it.days.forEach((d, i) => {
    if (d.index !== i + 1 || d.date !== addDays(input.start, i)) fail('days', `day ${i + 1} is ${d.date}`);
  });

  const seen = new Set<string>();
  for (const d of it.days) {
    if (d.activeMin > l.middleMin) fail('maxActive', `day ${d.index} has ${d.activeMin} active minutes`);
    const visits = d.stops.filter((s) => s.kind === 'visit');
    if ((d.kind === 'travel' || d.kind === 'free') && visits.length) fail('restDay', `day ${d.index} (${d.kind}) has sights`);
    if (d.kind === 'arrival' && sightMin(d) > l.arrivalMin) fail('lightFirst', `arrival day has ${sightMin(d)} min of sightseeing`);
    if (d.kind === 'departure' && sightMin(d) > l.departureMin) fail('lightLast', `departure day has ${sightMin(d)} min of sightseeing`);
    for (const s of visits) {
      const a = byId.get(s.attractionId!) ?? fail('unknown', `day ${d.index} visits ${s.attractionId}`);
      if (a.closedDays.includes(dayOfWeek(d.date))) fail('closedDay', `${a.name} is closed on ${d.date}`);
      if (toMin(s.start) < toMin(a.open) || toMin(s.start) + s.durationMin > toMin(a.close)) {
        fail('openingHours', `${a.name} at ${s.start} on ${d.date} is outside ${a.open}–${a.close}`);
      }
      if (seen.has(a.id)) fail('duplicate', `${a.name} is visited twice`);
      seen.add(a.id);
    }
  }

  const first = it.days[0]!;
  const last = it.days.at(-1)!;
  if (!['travel', 'arrival', 'departure'].includes(first.kind)) fail('lightFirst', `day 1 is a ${first.kind} day`);
  if (!['travel', 'departure'].includes(last.kind)) fail('lightLast', `day ${last.index} is a ${last.kind} day`);

  const nights = Math.max(0, diffDays(input.arrive.slice(0, 10), input.leave.slice(0, 10)));
  const baseIds = new Set(input.bases.map((b) => b.id));
  const atBase = it.days.filter((d) => baseIds.has(d.nightAt)).length;
  const planned = input.bases.reduce((s, b) => s + b.nights, 0);
  if (planned !== nights || atBase !== nights) fail('hotelNights', `${atBase} nights at bases, ${planned} planned, ${nights} at the destination`);

  const free = it.days.filter((d) => d.kind === 'free').length;
  const couldBeFree = it.days.some((d) => d.kind === 'sightseeing' || d.kind === 'free');
  if (input.days > 7 && couldBeFree && free !== 1) fail('freeDay', `${free} free days on a ${input.days}-day trip`);
  if (input.days <= 7 && free > 0) fail('freeDay', `free day on a ${input.days}-day trip`);
}
