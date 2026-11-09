'use client';

import type { GuideSection } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import type { GuideAnchor } from '../lib/guide-anchor';
import { dayMonth } from '../lib/format';

/** Where distances are measured from, when the content was last checked, and the sample-data flag. */
export function GuideFootnote({ guide, anchor }: { guide: GuideSection; anchor: GuideAnchor }) {
  const t = useTranslations('results.guide');
  const locale = useLocale();
  return (
    <p className="text-xs text-muted">
      {guide.sampleData && <b className="text-warn">{t('sample')} </b>}
      {t(anchor.isHotel ? 'fromHotel' : 'fromArea', { name: anchor.name })}{' '}
      {guide.guide &&
        t('verified', {
          date: `${dayMonth(guide.guide.lastVerifiedOn, locale)} ${guide.guide.lastVerifiedOn.slice(0, 4)}`,
        })}
    </p>
  );
}
