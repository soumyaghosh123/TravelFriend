'use client';

import type { HotelsSection, PricedWindow, TransportSection } from '@tripsaver/providers';
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
