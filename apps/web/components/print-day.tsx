'use client';

import type { PlannedDay } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { weekdayDayMonth } from '../lib/format';
import { useStopLine, type StopContext } from '../lib/use-stop-line';
import { Price } from './price';

/** One day of the printable plan: the same stops and wording as the Day-by-day tab, in a compact list. */
export function PrintDay({ day: d, ctx }: { day: PlannedDay; ctx: StopContext }) {
  const t = useTranslations('results.plan');
  const locale = useLocale();
  const line = useStopLine(d, ctx);
  const night = ctx.bases.find((b) => b.id === d.nightAt);
  return (
    <section className="break-inside-avoid border-b border-line py-2.5 last:border-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-bold">
          {t('dayN', { n: d.index })} · {weekdayDayMonth(d.date, locale)} · {t(`kind.${d.kind}`)}
        </h3>
        <Price amount={d.spend.total} isEstimate ownEstimate size="sm" />
      </header>
      <ul className="mt-1 space-y-0.5 text-sm">
        {d.stops.map((s, i) => {
          const l = line(s);
          return (
            <li key={i}>
              {s.kind !== 'journey' && s.kind !== 'free' && (
                <span className="mr-1.5 tabular-nums text-muted">{s.start}</span>
              )}
              <b>{l.what}</b>
              {l.how && <span className="text-ink2"> · {l.how}</span>}
            </li>
          );
        })}
      </ul>
      {night?.hotel && (
        <p className="mt-1 text-xs text-ink2">
          🏨 {t('tonight')} <b>{night.hotel.name}</b>
        </p>
      )}
    </section>
  );
}
