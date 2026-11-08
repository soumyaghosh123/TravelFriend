'use client';

import type { DirectionTransport, TransportOffer } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import { hm } from '../lib/transport-match';
import { Price } from './price';

const CARDS = [
  { key: 'cheapest', color: 'text-good', border: 'border-good' },
  { key: 'fastest', color: 'text-[#6366f1]', border: 'border-line' },
  { key: 'overnight', color: 'text-warn', border: 'border-line' },
] as const;

/** Cheapest / Fastest / Best overnight for one direction (mockup "Getting there"). */
export function TransportSummaryCards({ summary, people }: { summary: DirectionTransport['summary']; people: number }) {
  const t = useTranslations('results.transport');
  const tr = useTranslations('results');
  const line = (o: TransportOffer) => {
    const d = hm(o.durationMin);
    return t('summaryLine', { service: o.number ?? o.operator, from: o.fromPoint, to: o.toPoint, h: d.h, m: d.m, people });
  };
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {CARDS.map(({ key, color, border }) => {
        const o = summary[key];
        return (
          <div key={key} className={`rounded-xl border bg-white px-3 py-2.5 ${border}`}>
            <div className={`text-[11px] font-bold uppercase tracking-[.06em] ${color}`}>{t(`cards.${key}`)}</div>
            {o ? (
              <>
                <div className="text-[15px] font-extrabold">
                  {tr(`modes.${o.mode}`)} · {o.travelClass}
                </div>
                <div className="text-xs text-muted">{line(o)}</div>
                <div className="mt-1">
                  <Price amount={o.price.amount} isEstimate={o.isEstimate} offer={o} size="md" />
                </div>
              </>
            ) : (
              <div className="text-xs text-muted">{t(`cards.${key}None`)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
