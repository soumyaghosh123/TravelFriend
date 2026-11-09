'use client';

import { useCallback, useEffect, useState } from 'react';
import { bookedKey, loadBooked, saveBooked } from './booked';

function storage() {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** "Booked" ticks for a plan's checklist, kept in localStorage (PLAN §6.7; the database once accounts exist). */
export function useBooked(
  searchId: string,
  style: string,
  start: string,
): { booked: ReadonlySet<string>; toggle: (id: string) => void } {
  const key = bookedKey(searchId, style, start);
  const [booked, setBooked] = useState<ReadonlySet<string>>(new Set());
  // Read after mount so the server render and the first client render match.
  useEffect(() => setBooked(loadBooked(storage(), key)), [key]);
  const toggle = useCallback(
    (id: string) =>
      setBooked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        saveBooked(storage(), key, next);
        return next;
      }),
    [key],
  );
  return { booked, toggle };
}
