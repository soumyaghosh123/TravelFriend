'use client';

import type { HotelsSection, ItinerarySection, PricedWindow, TransportSection, TripStyle } from '@tripsaver/providers';
import type { SectionState } from './use-results-stream';
import { useSectionFor } from './use-section-for';

/** Getting-there data for the selected window's travel dates. */
export function useTransport(searchId: string, w: PricedWindow | null, streamed: SectionState<TransportSection>) {
  const query = w ? { onward: w.onward.departDate, return: w.return.departDate } : null;
  return useSectionFor(searchId, 'transport', query, streamed, (d) => !!query && d.onward.date === query.onward && d.return.date === query.return);
}

/** Hotels for the selected window's stay: arrival day → the day the return journey leaves. */
export function useHotels(searchId: string, w: PricedWindow | null, streamed: SectionState<HotelsSection>) {
  const query = w ? { checkIn: w.onward.arriveDate, checkOut: w.return.departDate } : null;
  return useSectionFor(searchId, 'hotels', query, streamed, (d) => !!query && d.checkIn === query.checkIn && d.checkOut === query.checkOut);
}

/** Day-by-day plan for the chosen plan style and start date. */
export function useItinerary(searchId: string, style: TripStyle, start: string | null, streamed: SectionState<ItinerarySection>) {
  const query = start ? { style, start } : null;
  return useSectionFor(searchId, 'itinerary', query, streamed, (d) => !!query && d.style === query.style && d.available && d.start === query.start);
}
