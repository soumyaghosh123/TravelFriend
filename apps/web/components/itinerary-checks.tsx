'use client';

import type { ItineraryLimits } from '@tripsaver/domain';
import type { ItineraryChecks as Checks } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { hm } from '../lib/transport-match';

/** "How this plan was checked": each hard rule with the plan's own numbers (mockup, brief §3.5). */
export function ItineraryChecks({ checks: c, limits }: { checks: Checks; limits: ItineraryLimits }) {
  const t = useTranslations('results.plan.checks');
  const locale = useLocale();
  const weekday = (n: number) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 10, 1 + n))); // 1 Nov 2026 is a Sunday
  const busiest = hm(c.busiest.activeMin);
  const items = [
    t('days', { n: c.days }),
    t('maxHours', { max: limits.middleMin / 60, day: c.busiest.index, h: busiest.h, m: busiest.m }),
    c.closedDays.length
      ? t('closed', { list: c.closedDays.map((x) => `${x.name} (${x.closedDays.map(weekday).join(', ')})`).join('; ') })
      : t('closedNone'),
    t('light', { first: limits.arrivalMin / 60, last: limits.departureMin / 60 }),
    c.freeDay ? t('free', { day: c.freeDay }) : t('freeNone'),
    t('nights', { n: c.nightsAtBases }),
  ];
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-2 text-[15px] font-bold">{t('title')}</h2>
      <ul className="space-y-1 text-sm">
        {items.map((x, i) => (
          <li key={i}>
            <span aria-hidden>✅ </span>
            {x}
          </li>
        ))}
      </ul>
    </section>
  );
}
