'use client';

import type {
  DatesSection,
  GuideSection,
  HotelsSection,
  ItinerarySection,
  TransportSection,
} from '@tripsaver/providers';
import { useCallback, useEffect, useState } from 'react';

export type SectionState<T> = { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error' };

export interface ResultsState {
  dates: SectionState<DatesSection>;
  /** transport, hotels, itinerary: for the Budget plan's cheapest dates (the default selection). */
  transport: SectionState<TransportSection>;
  hotels: SectionState<HotelsSection>;
  itinerary: SectionState<ItinerarySection>;
  /** Sights, food, shopping, do's & don'ts: the same for every plan and date. */
  guide: SectionState<GuideSection>;
}

const SECTIONS = ['dates', 'transport', 'hotels', 'itinerary', 'guide'] as const;
const INITIAL: ResultsState = {
  dates: { status: 'loading' },
  transport: { status: 'loading' },
  hotels: { status: 'loading' },
  itinerary: { status: 'loading' },
  guide: { status: 'loading' },
};

/**
 * Opens the SSE stream for a search and fills sections as they arrive (PLAN §7).
 * A section whose provider failed becomes `error`; `retry()` re-opens the stream.
 */
export function useResultsStream(searchId: string): ResultsState & { retry: () => void } {
  const [state, setState] = useState<ResultsState>(INITIAL);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setState(INITIAL);
    const es = new EventSource(`/api/search/${encodeURIComponent(searchId)}/stream`);
    let finished = false;

    for (const section of SECTIONS) {
      es.addEventListener(section, (e) => {
        const msg = JSON.parse((e as MessageEvent<string>).data) as
          { status: 'ok'; data: unknown } | { status: 'error' };
        setState((s) => ({
          ...s,
          [section]: msg.status === 'ok' ? { status: 'ok', data: msg.data } : { status: 'error' },
        }));
      });
    }
    es.addEventListener('done', () => {
      finished = true;
      es.close();
    });
    es.onerror = () => {
      if (finished) return;
      es.close();
      // Anything still loading when the connection drops is unavailable; the user can retry.
      setState((s) => {
        const next = { ...s };
        for (const k of SECTIONS) if (next[k].status === 'loading') next[k] = { status: 'error' };
        return next;
      });
    };
    return () => es.close();
  }, [searchId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
