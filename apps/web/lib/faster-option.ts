import type { DirectionTransport, TransportOffer } from '@tripsaver/providers';

/** Only suggest a quicker option when it saves at least this much journey time. */
export const MIN_TIME_SAVED_MIN = 180;

export interface FasterOption {
  offer: TransportOffer;
  /** Group fare difference vs the chosen leg; negative when the faster option is also cheaper. */
  extra: number;
  savedMin: number;
}

const sameService = (a: TransportOffer, b: TransportOffer) =>
  a.source === b.source && a.mode === b.mode && (a.number ?? a.operator) === (b.number ?? b.operator) && a.departAt === b.departAt;

/**
 * "✈ Fly instead: IndiGo 06:10 · 2 h 45 m · +₹4,840": the fastest direct option on the same day as
 * the chosen (cheapest) leg, when it saves real time. The trip total keeps the cheapest leg.
 */
export function fasterOption(chosen: TransportOffer, d: DirectionTransport | null): FasterOption | null {
  const fastest = d?.summary.fastest;
  if (!fastest || sameService(fastest, chosen)) return null;
  const savedMin = chosen.durationMin - fastest.durationMin;
  if (savedMin < MIN_TIME_SAVED_MIN) return null;
  return { offer: fastest, extra: fastest.price.amount - chosen.price.amount, savedMin };
}
