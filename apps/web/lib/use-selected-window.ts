'use client';

import type { WindowReason } from '@tripsaver/domain';
import type { PricedWindow, StyleDates, WindowDetail } from '@tripsaver/providers';
import { useCallback, useEffect, useState } from 'react';

export interface SelectedWindow {
  status: 'none' | 'loading' | 'ok' | 'error';
  window: PricedWindow | null;
  reasons: WindowReason[];
  rank?: number;
  saving?: number;
  /** Calendar estimate, for dates outside the top 3. */
  estimate?: number;
  retry: () => void;
}

/**
 * The priced window for the chosen plan and start date: taken from the top 3 when it is one of them,
 * otherwise re-priced on demand with bookable offers (GET /api/search/:id/window).
 */
export function useSelectedWindow(searchId: string, style: StyleDates | undefined, start: string | null): SelectedWindow {
  const top = style?.top.find((w) => w.start === start);
  const [fetched, setFetched] = useState<{ key: string; state: 'loading' | 'error' | WindowDetail } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${style?.style}|${start}`;

  useEffect(() => {
    if (!style || !start || top) return;
    const ctrl = new AbortController();
    setFetched({ key, state: 'loading' });
    fetch(`/api/search/${encodeURIComponent(searchId)}/window?style=${style.style}&start=${start}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setFetched({ key, state: (await r.json()) as WindowDetail });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFetched({ key, state: 'error' });
      });
    return () => ctrl.abort();
  }, [searchId, style, start, top, key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (!style || !start) return { status: 'none', window: null, reasons: [], retry };
  if (top) return { status: 'ok', window: top, reasons: top.reasons, rank: top.rank, saving: top.saving, retry };
  if (!fetched || fetched.key !== key || fetched.state === 'loading') return { status: 'loading', window: null, reasons: [], retry };
  if (fetched.state === 'error') return { status: 'error', window: null, reasons: [], retry };
  const d = fetched.state;
  return { status: 'ok', window: d.window, reasons: d.reasons, estimate: d.estimate, retry };
}
