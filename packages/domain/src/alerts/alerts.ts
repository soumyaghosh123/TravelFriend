import type { ISODate } from '../types.js';

/** What the daily check does with one price alert (spec 2026-11-10-price-alerts). */
export type AlertDecision = 'notify' | 'skip' | 'expire';

/**
 * Email when the trip's group total is below ₹X, and again only when it falls below the last emailed
 * total (no daily repeat for the same price). A trip whose start date has passed switches the alert off.
 */
export function decideAlert(a: {
  threshold: number;
  lastNotifiedAmount: number | null;
  currentTotal: number;
  startDate: ISODate;
  today: ISODate;
}): AlertDecision {
  if (a.startDate < a.today) return 'expire';
  const below = a.currentTotal < a.threshold;
  const lower = a.lastNotifiedAmount === null || a.currentTotal < a.lastNotifiedAmount;
  return below && lower ? 'notify' : 'skip';
}

/** The ₹X the form suggests: 5% below today's total, rounded down to ₹100. */
export function suggestAlertThreshold(total: number): number {
  return Math.floor((total * 0.95) / 100) * 100;
}
