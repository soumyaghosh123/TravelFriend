'use client';

import type { PeakWarning as Warning } from '@tripsaver/domain';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange, monthLabel } from '../lib/format';

/** Peak-season / big-event warning above the calendar, with a cheaper nearby month if there is one. */
export function PeakWarning({ warning, destinationMonth }: { warning: Warning; destinationMonth: string }) {
  const t = useTranslations('results.peak');
  const locale = useLocale();
  const e = warning.strongestEvent;
  return (
    <div role="note" className="flex gap-2.5 rounded-card border border-bad/25 bg-bad-l px-4 py-3 text-[13px] text-[#7f1d1d]">
      <span aria-hidden className="text-lg leading-5">
        ⚠️
      </span>
      <div>
        <b>{warning.isPeakMonth ? t('peakMonth', { month: destinationMonth }) : t('bigEvent')}</b>{' '}
        {e && t('event', { name: e.name, dates: dateRange(e.start, e.end, locale), pct: Math.round((e.priceImpact - 1) * 100) })}{' '}
        {warning.bestAlternative &&
          t.rich('alternative', {
            month: monthLabel(warning.bestAlternative.month, locale, 'long'),
            pct: warning.bestAlternative.savingPct,
            b: (c) => <b>{c}</b>,
          })}
      </div>
    </div>
  );
}
