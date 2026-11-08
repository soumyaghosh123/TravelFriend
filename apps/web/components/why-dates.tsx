'use client';

import type { CalendarEvent, WindowReason } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';
import { ReasonText } from './reason-text';

interface Props {
  events: CalendarEvent[];
  mostExpensive: { reasons: WindowReason[] } | null;
}

/** "Why some dates cost more": the month's price-raising events, strongest first, then weekends. */
export function WhyDates({ events, mostExpensive }: Props) {
  const t = useTranslations('results');
  const raising: WindowReason[] = events
    .filter((e) => e.priceImpact > 1)
    .sort((a, b) => b.priceImpact - a.priceImpact)
    .map((e) => ({ kind: e.kind, text: e.name, event: e }));
  // Generic weekend line (no night count) when weekend nights push some windows up.
  const hasWeekend = mostExpensive?.reasons.some((r) => r.kind === 'weekend');
  const reasons: WindowReason[] = hasWeekend ? [...raising, { kind: 'weekend', text: '' }] : raising;
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-2.5 text-[15px] font-bold">{t('whyTitle')}</h2>
      {reasons.length === 0 ? (
        <p className="text-sm text-muted">{t('whyNone')}</p>
      ) : (
        <ul className="m-0 list-disc space-y-1.5 pl-[18px] text-xs">
          {reasons.map((r, i) => (
            <li key={i}>
              <ReasonText reason={r} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
