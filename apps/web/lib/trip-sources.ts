import type { PricedWindow } from '@tripsaver/providers';

/** Sites behind a whole-trip total, for the <Price> source line. */
export function tripSources(w: PricedWindow, fetchedAt: string): { names: string[]; fetchedAt: string } {
  const names = [w.onward.sourceName, w.return.sourceName, w.hotel?.cheapest.sourceName].filter(
    (n): n is string => !!n,
  );
  return { names: [...new Set(names)], fetchedAt };
}
