'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SectionState } from './use-results-stream';

/**
 * A result section for the current selection. The stream carries it for the default selection
 * (Budget plan, cheapest dates); when the selection differs it is fetched from `path?query`.
 * `query` is null while the selection isn't known yet; `matches` says whether streamed data fits it.
 */
export function useSectionFor<T>(
  searchId: string,
  path: string,
  query: Record<string, string> | null,
  streamed: SectionState<T>,
  matches: (data: T) => boolean,
): SectionState<T> & { retry: () => void } {
  const qs = query ? new URLSearchParams(query).toString() : null;
  const fromStream = streamed.status === 'ok' && qs !== null && matches(streamed.data) ? streamed : null;
  const [fetched, setFetched] = useState<{ qs: string; state: SectionState<T> } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (qs === null || fromStream || streamed.status === 'loading') return;
    const ctrl = new AbortController();
    setFetched({ qs, state: { status: 'loading' } });
    fetch(`/api/search/${encodeURIComponent(searchId)}/${path}?${qs}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setFetched({ qs, state: { status: 'ok', data: (await r.json()) as T } });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFetched({ qs, state: { status: 'error' } });
      });
    return () => ctrl.abort();
  }, [searchId, path, qs, fromStream, streamed.status, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  if (fromStream) return { ...fromStream, retry };
  if (qs === null || streamed.status === 'loading' || !fetched || fetched.qs !== qs)
    return { status: 'loading', retry };
  return { ...fetched.state, retry };
}
