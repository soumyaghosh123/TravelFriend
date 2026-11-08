'use client';

import type { MonthAlternative, MonthComparison } from '@tripsaver/domain';
import { useLocale, useTranslations } from 'next-intl';
import { monthLabel, monthShort } from '../lib/format';

interface Props {
  months: MonthComparison[];
  chosen: number;
  alternative: MonthAlternative | null;
}

const COLOR = { cheap: '#dcfce7', normal: '#fef9c3', peak: '#fee2e2' } as const;

/** "Is another month cheaper?": typical price level by month (cheap / normal / peak) with weather. */
export function MonthCompare({ months, chosen, alternative }: Props) {
  const t = useTranslations('results');
  const locale = useLocale();
  if (months.length === 0) return null;
  const max = Math.max(...months.map((m) => m.priceIndex));
  const alt = alternative ? months.find((m) => m.month === Number(alternative.month.slice(5, 7))) : undefined;

  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-2.5 text-[15px] font-bold">{t('monthsTitle')}</h2>
      <div className="flex h-[130px] items-end gap-1" role="list" aria-label={t('monthsTitle')}>
        {months.map((m) => (
          <div
            key={m.month}
            role="listitem"
            aria-label={t('monthBar', { month: monthShort(m.month, locale), level: t(`level.${m.label}`), max: m.maxC, min: m.minC })}
            title={`${m.summary} · ${m.maxC}° / ${m.minC}°`}
            className="flex h-full flex-1 flex-col items-center justify-end text-[10px] text-muted"
          >
            <span
              className={`block w-full rounded-t-md border border-[#cbd5e1] ${m.month === chosen ? 'outline-2 outline-offset-1 outline-ink' : ''}`}
              style={{ height: `${Math.round((m.priceIndex / max) * 80)}%`, background: COLOR[m.label] }}
            />
            <span className={`mt-0.5 ${m.month === chosen ? 'font-bold text-ink' : ''}`}>{monthShort(m.month, locale)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-[11px] text-muted">
        {(['cheap', 'normal', 'peak'] as const).map((l) => (
          <span key={l} className="flex items-center gap-1">
            <i className="inline-block size-2.5 rounded-sm border border-[#cbd5e1]" style={{ background: COLOR[l] }} aria-hidden />
            {t(`level.${l}`)}
          </span>
        ))}
      </div>
      {alternative && alt && (
        <p className="mt-2.5 rounded-[10px] bg-brand-xl px-3 py-2 text-xs text-brand-d">
          💡{' '}
          {t.rich('alternativeTip', {
            month: monthLabel(alternative.month, locale, 'long'),
            pct: alternative.savingPct,
            weather: alt.summary,
            max: alt.maxC,
            min: alt.minC,
            b: (c) => <b>{c}</b>,
          })}
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted">{t('monthsBasis')}</p>
    </section>
  );
}
