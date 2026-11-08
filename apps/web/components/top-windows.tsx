'use client';

import type { StyleDates } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange, inr } from '../lib/format';
import { tripSources } from '../lib/trip-sources';
import { Price } from './price';

interface Props {
  style: StyleDates;
  selectedStart: string | null;
  onSelect: (start: string, total: number) => void;
}

/** "3 cheapest date windows", each with its saving against the most expensive window (brief §2.1). */
export function TopWindows({ style, selectedStart, onSelect }: Props) {
  const t = useTranslations('results');
  const locale = useLocale();
  const worst = style.mostExpensive;
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="mb-2.5 text-[15px] font-bold">{t('topTitle')}</h2>
      {style.top.length === 0 && <p className="text-sm text-muted">{t('noWindows')}</p>}
      <ol className="space-y-2">
        {style.top.map((w) => {
          const on = w.start === selectedStart;
          return (
            <li key={w.start}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(w.start, w.total)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${on ? 'border-brand bg-brand-xl' : 'border-line hover:border-brand/50'}`}
              >
                <span className="grid size-[26px] shrink-0 place-items-center rounded-full bg-good text-[13px] font-extrabold text-white">{w.rank}</span>
                <span className="min-w-0">
                  <span className="block font-bold">{dateRange(w.start, w.end, locale)}</span>
                  {w.saving > 0 && worst && (
                    <span className="block text-xs font-semibold text-good">
                      {w.rank === 1
                        ? t('saveVs', { amount: inr(w.saving), dates: dateRange(worst.start, worst.end, locale) })
                        : t('save', { amount: inr(w.saving) })}
                    </span>
                  )}
                </span>
                <span className="ml-auto text-right">
                  <Price amount={w.total} isEstimate sources={tripSources(w, style.fetchedAt)} size="md" />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
