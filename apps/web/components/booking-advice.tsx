'use client';

import { addDays } from '@tripsaver/domain';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { dayMonth } from '../lib/format';
import { todayInIndia } from '../lib/today';

interface Props {
  advice: { advanceDays: number; tatkalAcOpens: string; tatkalNonAcOpens: string };
  start: string;
  isPeakMonth: boolean;
}

function Item({ icon, title, body }: { icon: string; title: string; body: ReactNode }) {
  return (
    <li className="flex gap-2.5 border-b border-dashed border-line py-2 last:border-0">
      <span aria-hidden className="text-base">
        {icon}
      </span>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted">{body}</div>
      </div>
    </li>
  );
}

/** "When to book": train reservation window and Tatkal from the rail provider, plus general guidance. */
export function BookingAdvice({ advice, start, isPeakMonth }: Props) {
  const t = useTranslations('results.advice');
  const locale = useLocale();
  const opens = addDays(start, -advice.advanceDays);
  const open = opens <= todayInIndia();
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-1 text-[15px] font-bold">{t('title')}</h2>
      <ul>
        <Item
          icon="🚆"
          title={t('trainTitle', { days: advice.advanceDays })}
          body={t.rich(open ? 'trainOpen' : 'trainOpens', { start: dayMonth(start, locale), opens: dayMonth(opens, locale), b: (c) => <b>{c}</b> })}
        />
        <Item icon="⚡" title={t('tatkalTitle')} body={t('tatkalBody', { ac: advice.tatkalAcOpens, nonac: advice.tatkalNonAcOpens })} />
        <Item icon="✈️" title={t('flightsTitle')} body={t('flightsBody')} />
        <Item icon="🏨" title={t(isPeakMonth ? 'hotelsPeakTitle' : 'hotelsTitle')} body={t('hotelsBody')} />
      </ul>
      <p className="mt-1 text-[11px] text-muted">{t('basis')}</p>
    </section>
  );
}
