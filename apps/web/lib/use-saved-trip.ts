'use client';

import { useCallback, useEffect, useState } from 'react';
import { listTrips, saveTrip } from './account';

export type SavedTripState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'unsaved' }
  | { status: 'saving' }
  | { status: 'saved'; tripId: string }
  | { status: 'error' };

/** Whether this search + plan + start date is saved to the signed-in user's trips, and a way to save it. */
export function useSavedTrip(
  searchId: string,
  style: string,
  start: string | null,
): { state: SavedTripState; save: (title?: string) => Promise<'signin' | 'ok' | 'error'> } {
  const [state, setState] = useState<SavedTripState>({ status: 'loading' });

  useEffect(() => {
    if (!start) return;
    let live = true;
    listTrips()
      .then((trips) => {
        if (!live) return;
        if (trips === null) return setState({ status: 'anonymous' });
        const t = trips.find((x) => x.searchId === searchId && x.style === style && x.start === start);
        setState(t ? { status: 'saved', tripId: t.id } : { status: 'unsaved' });
      })
      .catch(() => live && setState({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [searchId, style, start]);

  const save = useCallback(
    async (title?: string) => {
      if (!start) return 'error' as const;
      setState({ status: 'saving' });
      try {
        const r = await saveTrip({ searchId, style, start, ...(title ? { title } : {}) });
        if (r === 'signin') {
          setState({ status: 'anonymous' });
          return 'signin' as const;
        }
        setState({ status: 'saved', tripId: r.id });
        return 'ok' as const;
      } catch {
        setState({ status: 'error' });
        return 'error' as const;
      }
    },
    [searchId, style, start],
  );

  return { state, save };
}
