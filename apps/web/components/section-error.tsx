'use client';

import { useTranslations } from 'next-intl';

/** "Temporarily unavailable – retry" for a section whose providers failed (PLAN §7). */
export function SectionError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('results');
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-card border border-bad/30 bg-bad-l px-4 py-3 text-bad"
    >
      <span className="font-semibold">{t('unavailable')}</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-bad shadow-card hover:bg-bad-l"
      >
        {t('retry')}
      </button>
    </div>
  );
}
