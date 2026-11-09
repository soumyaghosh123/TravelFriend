'use client';

import type { WindowReason } from '@tripsaver/domain';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange } from '../lib/format';

const BADGE: Record<WindowReason['kind'], string> = {
  season: 'bg-bad-l text-bad',
  holiday: 'bg-warn-l text-warn',
  festival: 'bg-warn-l text-warn',
  longWeekend: 'bg-warn-l text-warn',
  school: 'bg-warn-l text-warn',
  local: 'bg-warn-l text-warn',
  weekend: 'bg-line text-ink2',
};

/** One translated "why this costs more" line: badge, event name and dates, price effect. */
export function ReasonText({ reason }: { reason: WindowReason }) {
  const t = useTranslations('results.reasons');
  const locale = useLocale();
  const e = reason.event;
  return (
    <>
      <span
        className={`mr-1 inline-block rounded-full px-2 py-px text-[11px] font-bold ${BADGE[reason.kind]}`}
      >
        {t(`kind.${reason.kind}`)}
      </span>
      {e ? (
        <>
          <b>
            {e.name} ({dateRange(e.start, e.end, locale)})
          </b>
          {e.priceImpact > 1 && <> · {t('impact', { pct: Math.round((e.priceImpact - 1) * 100) })}</>}
        </>
      ) : reason.nights ? (
        t('weekendCount', { nights: reason.nights })
      ) : (
        t('weekend')
      )}
    </>
  );
}
