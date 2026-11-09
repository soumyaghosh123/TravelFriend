'use client';

import type { TravellerPriceLine } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';
import { inr } from '../lib/format';

/** "2 adults ₹5,300 + child (6 yrs) half ₹1,325 + child (3 yrs) free" (brief §2.4). */
export function FareBreakdown({ lines }: { lines: TravellerPriceLine[] }) {
  const t = useTranslations('results.transport');
  const ts = useTranslations('search');
  const parts = lines
    .filter((l) => l.count > 0)
    .map((l) =>
      l.age === undefined
        ? t('adultsLine', { count: l.count, amount: inr(l.amount) })
        : l.fareType === 'free'
          ? t('childFreeLine', { age: ts('ageYears', { age: l.age }) })
          : t('childLine', {
              age: ts('ageYears', { age: l.age }),
              fare: ts(`fare.${l.fareType}`),
              amount: inr(l.amount),
            }),
    );
  return <div className="text-[11px] text-muted">{parts.join(' + ')}</div>;
}
