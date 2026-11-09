'use client';

import type { LocalMode } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { monthLabel } from '../lib/format';

/** Where a local fare comes from: a published or notified fare (with date and link), or a sample. */
export function FareSource({ source }: { source: LocalMode['fareSource'] }) {
  const t = useTranslations('results.local.fareSource');
  const locale = useLocale();
  if (source.basis === 'sample')
    return <div className="text-[11px] font-semibold text-warn">{t('sample')}</div>;
  const label = t(source.basis, {
    name: source.name ?? '',
    date: source.asOf ? monthLabel(source.asOf, locale) : '',
  });
  return (
    <div className="text-[11px] text-good">
      {source.url ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
          {label}
        </a>
      ) : (
        label
      )}
    </div>
  );
}
