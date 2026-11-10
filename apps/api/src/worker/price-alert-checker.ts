import { decideAlert } from '@tripsaver/domain';
import type { AccountStore, ActiveAlert } from '../account/account-store.js';
import type { Mailer } from '../account/mailer.js';
import { todayInIndia } from '../search/search.controller.js';
import { alertEmail } from './alert-email.js';
import type { TripPricer } from './trip-pricer.js';

export interface AlertRunResult {
  checked: number;
  notified: number;
  expired: number;
  failed: number;
}

/**
 * The daily price-alert check (spec 2026-11-10-price-alerts): re-price each active alert's saved trip
 * and email when its total is below ₹X (and below the last emailed total). One failing alert is logged
 * and skipped; a failed email isn't recorded, so the next run tries again.
 */
export class PriceAlertChecker {
  constructor(
    private readonly store: AccountStore,
    private readonly pricer: TripPricer,
    private readonly mailer: Mailer,
    private readonly webOrigin: string,
  ) {}

  async runOnce(now: Date): Promise<AlertRunResult> {
    const result: AlertRunResult = { checked: 0, notified: 0, expired: 0, failed: 0 };
    for (const a of await this.store.activeAlerts()) {
      try {
        const outcome = await this.check(a, now);
        result.checked++;
        if (outcome === 'notify') result.notified++;
        if (outcome === 'expire') result.expired++;
      } catch (e) {
        result.failed++;
        console.error(`[alerts] ${a.alert.id} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return result;
  }

  private async check({ alert, trip, user }: ActiveAlert, now: Date): Promise<'notify' | 'skip' | 'expire'> {
    const today = todayInIndia(now);
    if (trip.start < today) {
      await this.store.recordAlertCheck(alert.id, { checkedAt: now, deactivate: true });
      return 'expire';
    }
    const priced = await this.pricer.price(trip, now);
    if (priced.kind === 'stale') {
      await this.store.recordAlertCheck(alert.id, { checkedAt: now, deactivate: true });
      return 'expire';
    }
    if (priced.kind === 'unavailable') {
      console.warn(`[alerts] ${alert.id}: no trip can start on ${trip.start} any more`);
      await this.store.recordAlertCheck(alert.id, { checkedAt: now });
      return 'skip';
    }
    const decision = decideAlert({
      threshold: alert.threshold,
      lastNotifiedAmount: alert.lastNotifiedAmount,
      currentTotal: priced.total,
      startDate: trip.start,
      today,
    });
    if (decision === 'notify' && user.email) {
      await this.mailer.send(
        alertEmail({
          to: user.email,
          locale: user.locale,
          destination: priced.destination,
          style: trip.style,
          start: priced.start,
          end: priced.end,
          total: priced.total,
          perPerson: priced.perPerson,
          threshold: alert.threshold,
          tripId: trip.id,
          webOrigin: this.webOrigin,
        }),
      );
      await this.store.recordAlertCheck(alert.id, { checkedAt: now, notifiedAmount: priced.total });
      return 'notify';
    }
    await this.store.recordAlertCheck(alert.id, {
      checkedAt: now,
      ...(decision === 'expire' ? { deactivate: true } : {}),
    });
    return decision === 'notify' ? 'skip' : decision;
  }
}
