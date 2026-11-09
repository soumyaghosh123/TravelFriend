'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookedOnServer, setBookedOnServer } from './account';
import { bookedKey, loadBooked, saveBooked } from './booked';

function storage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * "Booked" ticks for a plan's checklist (PLAN §6.7). Kept in localStorage; once the trip is saved to an
 * account (`tripId`), they live on the server too, so they follow you to other devices. Ticks made
 * before saving are carried over the first time.
 */
export function useBooked(
  searchId: string,
  style: string,
  start: string,
  tripId?: string | null,
): { booked: ReadonlySet<string>; toggle: (id: string) => void } {
  const key = bookedKey(searchId, style, start);
  const [booked, setBooked] = useState<ReadonlySet<string>>(new Set());

  // Read after mount so the server render and the first client render match.
  useEffect(() => {
    const local = loadBooked(storage(), key);
    setBooked(local);
    if (!tripId) return;
    let live = true;
    bookedOnServer(tripId)
      .then(async (remote) => {
        if (!live) return;
        if (remote.length === 0 && local.size > 0) {
          await Promise.all([...local].map((id) => setBookedOnServer(tripId, id, true)));
          return;
        }
        const merged = new Set(remote);
        saveBooked(storage(), key, merged);
        setBooked(merged);
      })
      .catch(() => {
        // Offline or signed out: keep the local ticks.
      });
    return () => {
      live = false;
    };
  }, [key, tripId]);

  const toggle = useCallback(
    (id: string) =>
      setBooked((prev) => {
        const next = new Set(prev);
        const on = !next.has(id);
        if (on) next.add(id);
        else next.delete(id);
        saveBooked(storage(), key, next);
        if (tripId) void setBookedOnServer(tripId, id, on).catch(() => {});
        return next;
      }),
    [key, tripId],
  );
  return { booked, toggle };
}
