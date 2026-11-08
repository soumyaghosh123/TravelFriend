'use client';

import type { DatesSection } from '@tripsaver/providers';
import { useCallback, useEffect, useState } from 'react';

export type SectionState<T> = { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error' };

export interface ResultsState {
  dates: SectionState<DatesSection>;
}

const INITIAL: ResultsState = { dates: { status: 'loading' } };

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

    es.addEventListener('dates', (e) => {
      const msg = JSON.parse((e as MessageEvent<string>).data) as { status: 'ok'; data: DatesSection } | { status: 'error' };
      setState((s) => ({ ...s, dates: msg.status === 'ok' ? { status: 'ok', data: msg.data } : { status: 'error' } }));
    });
    es.addEventListener('done', () => {
      finished = true;
      es.close();
    });
    es.onerror = () => {
      if (finished) return;
      es.close();
      // Anything still loading when the connection drops is unavailable; the user can retry.
      setState((s) => ({ dates: s.dates.status === 'loading' ? { status: 'error' } : s.dates }));
    };
    return () => es.close();
  }, [searchId, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}
