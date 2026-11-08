import { diffDays } from '@tripsaver/domain';
import type { PricedWindow, TransportOffer, TransportSection } from '@tripsaver/providers';

export interface SlowModeTip {
  /** Extra cost for the group, both ways (can't be negative: we only suggest it when it costs more). */
  extra: number;
  /** About how many more days at the destination. */
  daysGained: number;
  onward: TransportOffer;
  back: TransportOffer;
}

/** More than this share of the trip on the way there and back triggers the tip (PLAN A1). */
export const SLOW_SHARE = 0.2;

/**
 * "This plan takes the train: 2 of the 10 days are spent travelling. Fly instead for +₹8,400 and get
 * about 2 more days" (PLAN A1). Uses the fastest option each way; assumes a fast option home also runs
 * on the trip's last day (daily flights), so you can stay until then.
 */
export function slowModeTip(w: PricedWindow, days: number, travelDays: number, t: TransportSection | null): SlowModeTip | null {
  if (!t || travelDays / days <= SLOW_SHARE) return null;
  const onward = t.onward.summary.fastest;
  const back = t.return.summary.fastest;
  if (!onward || !back || onward.mode !== 'flight' || back.mode !== 'flight') return null;
  const gainedThere = Math.max(0, diffDays(onward.arriveDate, w.onward.arriveDate));
  const gainedBack = Math.max(0, diffDays(w.return.departDate, w.end));
  const daysGained = gainedThere + gainedBack;
  const extra = onward.price.amount + back.price.amount - (w.onward.price.amount + w.return.price.amount);
  if (daysGained < 1 || extra <= 0) return null;
  return { extra, daysGained, onward, back };
}
