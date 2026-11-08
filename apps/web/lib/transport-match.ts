import type { TransportOffer } from '@tripsaver/providers';

/** Same departure and class: used to mark the option a plan has chosen. */
export function sameOffer(a: TransportOffer | undefined, b: TransportOffer | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.mode === b.mode &&
    (a.number ?? a.operator) === (b.number ?? b.operator) &&
    a.travelClass === b.travelClass &&
    a.departAt === b.departAt
  );
}

/** Hours and minutes for a duration label. */
export function hm(totalMin: number): { h: number; m: number } {
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}
