'use client';

import type { PricedWindow, TransportSection, TripStyle } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { dayMonth } from '../lib/format';
import { CombinedRouteCard } from './combined-route-card';
import { Price } from './price';
import { Segmented } from './segmented';
import { TransportServiceCard } from './transport-service-card';
import { TransportSummaryCards } from './transport-summary-cards';

type Dir = 'onward' | 'return';
type View = 'train' | 'bus' | 'flight' | 'combined';

interface Props {
  transport: TransportSection;
  /** The selected plan's priced window: its legs are highlighted and totalled. */
  window: PricedWindow;
  style: TripStyle;
  people: number;
}

const ICON: Record<View, string> = { train: '🚆', bus: '🚌', flight: '✈️', combined: '🔀' };

/** Tab 3 "Getting there and back" (brief §2.2): every direct option both ways, summary cards, combined routes. */
export function GettingThereTab({ transport, window: w, style, people }: Props) {
  const t = useTranslations('results.transport');
  const tr = useTranslations('results');
  const locale = useLocale();
  const [dir, setDir] = useState<Dir>('onward');
  const [view, setView] = useState<View>(w.onward.mode);
  const d = transport[dir];
  const chosen = dir === 'onward' ? w.onward : w.return;
  const planName = tr(`plans.${style}.name`);

  // Open on the mode the plan uses for this direction.
  useEffect(() => setView(chosen.mode), [chosen.mode, dir]);

  const services = view === 'combined' ? [] : d.services.filter((s) => s.mode === view);
  const anyEstimate = [...transport.onward.services, ...transport.return.services].some((s) =>
    s.offers.some((o) => o.isEstimate),
  );
  const legsTotal = w.onward.price.amount + w.return.price.amount;

  return (
    <div className="space-y-3.5">
      <Segmented<Dir>
        label={t('direction')}
        value={dir}
        onChange={setDir}
        options={[
          {
            id: 'onward',
            label: t('onwardTab', {
              date: dayMonth(transport.onward.date, locale),
              from: transport.onward.from.name,
              to: transport.onward.to.name,
            }),
          },
          {
            id: 'return',
            label: t('returnTab', {
              date: dayMonth(transport.return.date, locale),
              from: transport.return.from.name,
              to: transport.return.to.name,
            }),
          },
        ]}
      />

      <TransportSummaryCards summary={d.summary} people={people} />

      <section className="rounded-card bg-white p-4 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold">
            {t('title', { from: d.from.name, to: d.to.name, date: dayMonth(d.date, locale) })}
          </h2>
          <Segmented<View>
            label={t('modes')}
            value={view}
            onChange={setView}
            options={(['train', 'bus', 'flight', 'combined'] as const).map((m) => ({
              id: m,
              label: `${ICON[m]} ${m === 'combined' ? t('combined') : tr(`modes.${m}`)} (${m === 'combined' ? d.combined.length : d.services.filter((s) => s.mode === m).length})`,
            }))}
          />
        </div>

        {view !== 'combined' && d.noDirect.includes(view) && (
          <p className="rounded-[10px] bg-bg px-3 py-2 text-sm text-ink2">
            {t('noDirect', { mode: tr(`modes.${view}`).toLowerCase(), from: d.from.name, to: d.to.name })}
            {d.combined.length > 0 && (
              <>
                {' '}
                <button
                  type="button"
                  className="font-semibold text-brand hover:underline"
                  onClick={() => setView('combined')}
                >
                  {t('seeCombined')}
                </button>
              </>
            )}
          </p>
        )}

        <div className="space-y-2.5">
          {services.map((s) => (
            <TransportServiceCard key={s.key} service={s} chosen={chosen} planName={planName} />
          ))}
          {view === 'combined' &&
            (d.combined.length ? (
              d.combined.map((c) => <CombinedRouteCard key={c.key} route={c} />)
            ) : (
              <p className="text-sm text-muted">{t('noCombined')}</p>
            ))}
        </div>
        {view === 'combined' && d.combined.length > 0 && (
          <p className="mt-2 text-xs text-muted">{t('combinedNote')}</p>
        )}
      </section>

      <section className="flex flex-wrap items-start justify-between gap-3 rounded-card bg-white p-4 shadow-card">
        <div className="max-w-xl text-sm">
          <h2 className="font-bold">{t('totalTitle', { plan: planName, people })}</h2>
          <p className="text-xs text-muted">
            {t('totalSub', {
              onward: `${tr(`modes.${w.onward.mode}`)} ${w.onward.travelClass}`,
              back: `${tr(`modes.${w.return.mode}`)} ${w.return.travelClass}`,
            })}
          </p>
        </div>
        <Price
          amount={legsTotal}
          isEstimate={w.onward.isEstimate || w.return.isEstimate}
          sources={{
            names: [...new Set([w.onward.sourceName, w.return.sourceName])],
            fetchedAt: w.onward.fetchedAt,
          }}
          size="lg"
        />
      </section>

      <p className="text-xs text-muted">
        {transport.sampleData && <b className="text-warn">{t('sample')} </b>}
        {anyEstimate && t('childEstimate')}
      </p>
    </div>
  );
}
