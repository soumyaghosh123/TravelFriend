'use client';

import type { CombinedRoute, TransportOffer } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dayMonth } from '../lib/format';
import { hm } from '../lib/transport-match';
import { Price } from './price';

const ICON = { train: '🚆', bus: '🚌', flight: '✈️' } as const;

/** A two-leg journey via a hub; each leg is booked separately, so each has its own price and link. */
export function CombinedRouteCard({ route: r }: { route: CombinedRoute }) {
  const t = useTranslations('results.transport');
  const tr = useTranslations('results');
  const locale = useLocale();
  const when = (iso: string) => `${dayMonth(iso.slice(0, 10), locale)} ${iso.slice(11, 16)}`;
  const leg = (o: TransportOffer) => (
    <li className="flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="font-semibold">
          <span aria-hidden>{ICON[o.mode]} </span>
          {tr(`modes.${o.mode}`)} · {o.number ?? o.operator} · {o.travelClass}
        </div>
        <div className="text-xs text-muted">
          {o.fromPoint} {when(o.departAt)} → {o.toPoint} {when(o.arriveAt)} · {t('duration', hm(o.durationMin))}
        </div>
      </div>
      <div className="sm:w-56 sm:shrink-0 sm:text-right">
        <Price amount={o.price.amount} isEstimate={o.isEstimate} offer={o} size="sm" />
      </div>
    </li>
  );
  const total = hm(r.durationMin);
  const wait = hm(r.waitMin);
  return (
    <article className="rounded-xl border border-line p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">{t('via', { hub: r.via.name })}</h3>
        <div className="text-sm">
          <Price amount={r.groupFare} isEstimate={r.first.isEstimate || r.second.isEstimate} sources={{ names: [...new Set([r.first.sourceName, r.second.sourceName])], fetchedAt: r.first.fetchedAt }} size="md" note={t('combinedTotal', { h: total.h, m: total.m })} />
        </div>
      </header>
      <ul className="mt-1 divide-y divide-dashed divide-line">
        {leg(r.first)}
        <li className="py-1.5 text-xs text-warn">⏱ {t('wait', { hub: r.via.name, h: wait.h, m: wait.m })}</li>
        {leg(r.second)}
      </ul>
    </article>
  );
}
