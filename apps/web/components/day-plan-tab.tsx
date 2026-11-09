'use client';

import type { ItinerarySection, PricedWindow, TransportSection } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange } from '../lib/format';
import { slowModeTip } from '../lib/slow-mode';
import { ItineraryChecks } from './itinerary-checks';
import { ItineraryDay } from './itinerary-day';
import { Price } from './price';

interface Props {
  plan: ItinerarySection;
  window: PricedWindow;
  /** For the "fly instead" tip; null while it loads. */
  transport: TransportSection | null;
  onPickPlan: (style: 'budget') => void;
}

/** Tab 2 "Day-by-day plan" (brief §3.5): bases, every day's slots, spend and hotel, and the rule checks. */
export function DayPlanTab({ plan, window: w, transport, onPickPlan }: Props) {
  const t = useTranslations('results.plan');
  const tr = useTranslations('results');
  const locale = useLocale();

  if (!plan.available) {
    const alt = plan.nearestAlternative;
    return (
      <section className="rounded-card bg-white p-4 shadow-card">
        <h2 className="text-[15px] font-bold">{t('noOffbeatTitle')}</h2>
        <p className="mt-1 text-sm text-ink2">
          {alt
            ? t('noOffbeatAlt', { name: alt.name, destination: alt.destinationName, km: alt.distanceKm })
            : t('noOffbeatNone')}
        </p>
        <button
          type="button"
          onClick={() => onPickPlan('budget')}
          className="mt-3 rounded-[10px] bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-d"
        >
          {t('showBudget')}
        </button>
      </section>
    );
  }

  // Days lost to the journey: on board, or arrival/departure days with no time for sights.
  const lost = plan.days.filter(
    (d) =>
      d.kind === 'travel' ||
      ((d.kind === 'arrival' || d.kind === 'departure') && !d.stops.some((s) => s.kind === 'visit')),
  ).length;
  const tip = slowModeTip(w, plan.days.length, lost, transport);
  const unscheduled = plan.unscheduled.map((id) => plan.attractions[id]).filter(Boolean);
  const warned = Object.values(plan.attractions).filter(
    (a) => a.warnings && plan.days.some((d) => d.stops.some((s) => s.attractionId === a.id)),
  );

  return (
    <div className="space-y-3.5">
      <section className="rounded-card bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-bold">
            {t('title', {
              plan: tr(`plans.${plan.style}.name`),
              dates: dateRange(plan.start, plan.end, locale),
              days: plan.days.length,
            })}
          </h2>
          <span className="text-xs text-muted">
            {plan.bases.map((b) => t('baseNights', { name: b.name, nights: b.nights })).join(' → ')}
          </span>
        </div>

        {tip && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3 rounded-[10px] bg-brand-xl px-3 py-2 text-sm text-brand-d">
            <span>🚆 {t('slowTip', { lost, days: plan.days.length, gained: tip.daysGained })}</span>
            <Price
              amount={tip.extra}
              isEstimate={tip.onward.isEstimate || tip.back.isEstimate}
              sources={{
                names: [...new Set([tip.onward.sourceName, tip.back.sourceName])],
                fetchedAt: tip.onward.fetchedAt,
              }}
              size="sm"
              note={t('slowTipExtra')}
            />
          </div>
        )}

        <div className="mt-1">
          {plan.days.map((d) => (
            <ItineraryDay
              key={d.index}
              day={d}
              attractions={plan.attractions}
              bases={plan.bases}
              window={w}
              arrivalPoint={plan.arrivalPoint}
              departurePoint={plan.departurePoint}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <ItineraryChecks checks={plan.checks} limits={plan.limits} />
        <section className="rounded-card bg-white p-4 shadow-card">
          <h2 className="mb-2 text-[15px] font-bold">{t('notesTitle')}</h2>
          {warned.length > 0 && (
            <ul className="mb-2 space-y-1 text-sm">
              {warned.map((a) => (
                <li key={a.id}>
                  ⚠️ <b>{a.name}:</b>{' '}
                  {[a.warnings?.road, a.warnings?.network, a.warnings?.permit].filter(Boolean).join(' · ')}
                </li>
              ))}
            </ul>
          )}
          {unscheduled.length > 0 && (
            <p className="text-sm text-ink2">
              {t('ifTime')} {unscheduled.map((a) => a!.name).join(', ')}
            </p>
          )}
          {warned.length === 0 && unscheduled.length === 0 && (
            <p className="text-sm text-muted">{t('notesNone')}</p>
          )}
          <p className="mt-2 text-xs text-muted">
            {plan.sampleData && <b className="text-warn">{t('sample')} </b>}
            {t('spendBasis')}
          </p>
        </section>
      </div>
    </div>
  );
}
