'use client';

import type { TransportOffer, TransportService } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dayMonth } from '../lib/format';
import { hm, sameOffer } from '../lib/transport-match';
import { FareBreakdown } from './fare-breakdown';
import { Price } from './price';

interface Props {
  service: TransportService;
  /** The option the selected plan uses, highlighted. */
  chosen?: TransportOffer;
  planName: string;
}

/** Confirmation chance → colours: likely (green), maybe (amber), unlikely (red). */
function availColors(pct: number): { text: string; bar: string } {
  if (pct >= 90) return { text: 'text-good', bar: 'bg-good' };
  if (pct >= 60) return { text: 'text-warn', bar: 'bg-accent' };
  return { text: 'text-bad', bar: 'bg-bad' };
}

/** One departure (train, bus or flight) with a row per class: group fare, breakdown, availability, booking link. */
export function TransportServiceCard({ service: s, chosen, planName }: Props) {
  const t = useTranslations('results.transport');
  const locale = useLocale();
  const d = hm(s.durationMin);
  const when = (iso: string) => `${dayMonth(iso.slice(0, 10), locale)} ${iso.slice(11, 16)}`;

  return (
    <article className="rounded-xl border border-line p-3">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <div>
          <h3 className="font-bold">{s.number ?? s.operator}</h3>
          <div className="text-xs text-muted">
            {s.operator !== s.number && s.number ? `${s.operator} · ` : ''}
            {s.fromPoint} → {s.toPoint}
          </div>
        </div>
        <div className="text-sm">
          <b>{when(s.departAt)}</b> → <b>{when(s.arriveAt)}</b>
          <span className="ml-2 text-muted">{t('duration', d)}</span>
        </div>
      </header>
      <ul className="mt-2 divide-y divide-dashed divide-line">
        {s.offers.map((o) => {
          const mine = sameOffer(o, chosen);
          return (
            <li
              key={o.travelClass}
              className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-4 ${mine ? '-mx-2 rounded-lg bg-brand-xl px-2' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{o.travelClass}</b>
                  {mine && (
                    <span className="rounded-full bg-brand px-2 py-px text-[11px] font-bold text-white">
                      {t('inPlan', { plan: planName })}
                    </span>
                  )}
                </div>
                {o.breakdown && <FareBreakdown lines={o.breakdown} />}
                {o.availability && o.confirmChancePct !== undefined && (
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`font-bold ${availColors(o.confirmChancePct).text}`}>
                      {o.availability}
                    </span>
                    <span
                      className="inline-block h-1.5 w-[60px] overflow-hidden rounded-full bg-line"
                      aria-hidden
                    >
                      <i
                        className={`block h-full ${availColors(o.confirmChancePct).bar}`}
                        style={{ width: `${o.confirmChancePct}%` }}
                      />
                    </span>
                    <span className="text-muted">{t('confirmChance', { pct: o.confirmChancePct })}</span>
                  </div>
                )}
              </div>
              <div className="sm:w-56 sm:shrink-0 sm:text-right">
                <Price amount={o.price.amount} isEstimate={o.isEstimate} offer={o} size="md" />
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
