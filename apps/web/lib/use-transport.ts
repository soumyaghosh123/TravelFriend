'use client';

import type { PricedWindow, TransportSection } from '@tripsaver/providers';
import { useCallback, useEffect, useState } from 'react';
import type { SectionState } from './use-results-stream';

/**
 * Getting-there data for the selected window's travel dates. The stream already carries the
 * default selection (Budget plan, cheapest dates); other dates are fetched on demand.
 */
export function useTransport(
  searchId: string,
  window: PricedWindow | null,
  streamed: SectionState<TransportSection>,
): SectionState<TransportSection> & { retry: () => void } {
  const onward = window?.onward.departDate;
  const back = window?.return.departDate;
  const key = onward && back ? `${onward}|${back}` : null;
  const fromStream =
    streamed.status === 'ok' && key === `${streamed.data.onward.date}|${streamed.data.return.date}` ? streamed : null;
  const [fetched, setFetched] = useState<{ key: string; state: SectionState<TransportSection> } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key || fromStream || streamed.status === 'loading') return;
    const ctrl = new AbortController();
    setFetched({ key, state: { status: 'loading' } });
    fetch(`/api/search/${encodeURIComponent(searchId)}/transport?onward=${onward}&return=${back}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setFetched({ key, state: { status: 'ok', data: (await r.json()) as TransportSection } });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFetched({ key, state: { status: 'error' } });
      });
    return () => ctrl.abort();
  }, [searchId, key, onward, back, fromStream, streamed.status, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (fromStream) return { ...fromStream, retry };
  if (!key || streamed.status === 'loading') return { status: 'loading', retry };
  if (!fetched || fetched.key !== key) return { status: 'loading', retry };
  return { ...fetched.state, retry };
}
