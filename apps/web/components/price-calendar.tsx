'use client';

import { addDays, daysInMonth, dayOfWeek, isoDate } from '@tripsaver/domain';
import type { StyleDates } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { compactInr, dayMonth, inr } from '../lib/format';
import { Price } from './price';

interface Props {
  year: number;
  month: number;
  days: number;
  style: StyleDates;
  selectedStart: string | null;
  onSelect: (start: string) => void;
}

/** Green → red bands (PLAN §9.1), matching the mockup's b1…b5. */
export const BAND_CLASS = {
  1: 'bg-[#dcfce7] text-[#14532d]',
  2: 'bg-[#ecfccb] text-[#365314]',
  3: 'bg-[#fef9c3] text-[#713f12]',
  4: 'bg-[#ffedd5] text-[#7c2d12]',
  5: 'bg-[#fee2e2] text-[#7f1d1d]',
} as const;

/** Month grid (Mon–Sun): each start date coloured by the whole trip's approximate cost. */
export function PriceCalendar({ year, month, days, style, selectedStart, onSelect }: Props) {
  const t = useTranslations('results');
  const locale = useLocale();
  const total = daysInMonth(year, month);
  const first = isoDate(year, month, 1);
  const lead = (dayOfWeek(first) + 6) % 7; // Monday first
  const selectedEnd = selectedStart ? addDays(selectedStart, days - 1) : null;
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2026, 10, 2 + i)), // 2 Nov 2026 is a Monday
    ),
  );
  const cheapestStart = style.top[0]?.start;

  return (
    <>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {weekdays.map((d) => (
          <div key={d} className="pb-0.5 text-center text-[11px] font-semibold text-muted" aria-hidden>
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`lead-${i}`} />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const date = isoDate(year, month, i + 1);
          const cell = style.cells.find((c) => c.start === date);
          const inWindow = !!selectedStart && !!selectedEnd && date >= selectedStart && date <= selectedEnd;
          const base = 'min-h-[50px] rounded-[10px] border-2 px-0.5 py-1.5 text-center sm:min-h-[54px]';
          const outline = inWindow ? 'outline-2 -outline-offset-2 outline-dashed outline-brand' : '';
          if (!cell?.feasible || cell.band === null) {
            return (
              <div key={date} className={`${base} border-transparent bg-[#f1f5f9] text-[#94a3b8] ${outline}`} title={cell ? t('noTripThatDay') : t('pastMonthEnd')}>
                <div className="text-[13px] font-bold">{i + 1}</div>
                <div className="text-[11px] font-semibold">—</div>
              </div>
            );
          }
          const selected = date === selectedStart;
          return (
            <button
              key={date}
              type="button"
              aria-pressed={selected}
              aria-label={t('cellLabel', { date: dayMonth(date, locale), amount: inr(cell.total) })}
              onClick={() => onSelect(date)}
              className={`${base} ${BAND_CLASS[cell.band]} ${selected ? 'border-ink' : 'border-transparent hover:border-ink/30'} ${outline}`}
            >
              <div className="text-[13px] font-bold">
                {i + 1}
                {date === cheapestStart && <span aria-hidden> ★</span>}
              </div>
              <div className="text-[11px] font-semibold tabular-nums">{compactInr(cell.total)}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[11px] text-muted">
        {t('cheapest')}
        {([1, 2, 3, 4, 5] as const).map((b) => (
          <i key={b} className={`inline-block h-2.5 w-[22px] rounded-[3px] ${BAND_CLASS[b]}`} aria-hidden />
        ))}
        {t('mostExpensive')} · <span className="text-[#cbd5e1]">■</span> {t('pastMonthEnd')}
      </div>
      <div className="mt-2 text-[11px] text-muted">
        {t('calendarBasis', { perDay: inr(style.localPerDay) })}{' '}
        {/* Calendar figures are estimates: source and freshness shown once for the grid (golden rule 1). */}
        <span className="inline-block align-middle">
          <Price amount={style.cells.find((c) => c.start === cheapestStart)?.total ?? 0} isEstimate size="sm" sources={{ names: style.sources, fetchedAt: style.fetchedAt }} note={t('calendarFrom')} />
        </span>
      </div>
    </>
  );
}
