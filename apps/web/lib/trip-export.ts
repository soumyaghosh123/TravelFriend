import { buildIcs, googleCalendarUrl, type IcsEvent } from '@tripsaver/domain';
import type { ItinerarySection, PricedWindow, TransportOffer } from '@tripsaver/providers';
import type { useTranslations } from 'next-intl';
import { makeStopLine } from './use-stop-line';

type Translate = ReturnType<typeof useTranslations>;
type Plan = Extract<ItinerarySection, { available: true }>;

/** The link that reopens this exact plan: same search, plan and start date. */
export function shareUrl(origin: string, searchId: string, style: string, start: string): string {
  return `${origin}/trip/${encodeURIComponent(searchId)}?${new URLSearchParams({ plan: style, start })}`;
}

/** WhatsApp "click to chat" with the message filled in; the user picks who to send it to. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function legEvent(id: string, o: TransportOffer, title: string): IcsEvent {
  return {
    uid: id,
    title,
    start: o.departAt.slice(0, 16),
    end: o.arriveAt.slice(0, 16),
    location: `${o.fromPoint} → ${o.toPoint}`,
  };
}

/**
 * Calendar entries for a plan: one all-day entry per day (with the day's stops, worded as on the
 * Day-by-day tab) and a timed entry for the journey there and back.
 */
export function planCalendarEvents(
  plan: Plan,
  w: PricedWindow,
  searchId: string,
  t: { plan: Translate; results: Translate },
): IcsEvent[] {
  const ctx = {
    attractions: plan.attractions,
    bases: plan.bases,
    window: w,
    arrivalPoint: plan.arrivalPoint,
    departurePoint: plan.departurePoint,
  };
  const uid = (x: string) => `${searchId}-${plan.style}-${plan.start}-${x}`;
  const leg = (o: TransportOffer) =>
    `${t.results(`modes.${o.mode}`)} ${o.number ?? o.operator} · ${o.travelClass}`;
  const days: IcsEvent[] = plan.days.map((d) => {
    const line = makeStopLine(t.plan, t.results, d, ctx);
    const description = d.stops
      .map((s) => {
        const l = line(s);
        const time = s.kind !== 'journey' && s.kind !== 'free' ? `${s.start} ` : '';
        return `${time}${l.what}${l.how ? ` (${l.how})` : ''}`;
      })
      .join('\n');
    return {
      uid: uid(`day-${d.index}`),
      title: `${t.plan('dayN', { n: d.index })} · ${t.plan(`kind.${d.kind}`)}`,
      date: d.date,
      description,
    };
  });
  return [
    legEvent(uid('onward'), w.onward, leg(w.onward)),
    ...days,
    legEvent(uid('return'), w.return, leg(w.return)),
  ];
}

export function planIcs(
  plan: Plan,
  w: PricedWindow,
  searchId: string,
  calendarName: string,
  t: { plan: Translate; results: Translate },
  now: string,
): string {
  return buildIcs(calendarName, planCalendarEvents(plan, w, searchId, t), now);
}

export { googleCalendarUrl };
