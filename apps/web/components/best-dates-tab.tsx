'use client';

import type { DatesSection, StyleDates, WindowDetail } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { monthLabel } from '../lib/format';
import { BookingAdvice } from './booking-advice';
import { MonthCompare } from './month-compare';
import { PeakWarning } from './peak-warning';
import { PriceCalendar } from './price-calendar';
import { SectionError } from './section-error';
import { SkeletonBlock } from './skeleton-block';
import { TopWindows } from './top-windows';
import { WhyDates } from './why-dates';
import { WindowDetailCard } from './window-detail-card';

interface Props {
  searchId: string;
  dates: DatesSection;
  style: StyleDates;
  people: number;
  selectedStart: string | null;
  onSelect: (start: string, total: number | null) => void;
}

type Detail = { status: 'loading' } | { status: 'ok'; detail: WindowDetail } | { status: 'error' };

/** Tab 1: price calendar, 3 cheapest windows, why dates cost more, month comparison, when to book. */
export function BestDatesTab({ searchId, dates, style, people, selectedStart, onSelect }: Props) {
  const t = useTranslations('results');
  const locale = useLocale();
  const month = `${dates.year}-${String(dates.month).padStart(2, '0')}`;
  const top = style.top.find((w) => w.start === selectedStart);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [attempt, setAttempt] = useState(0);

  // A date outside the top 3 is re-priced on demand with bookable offers.
  useEffect(() => {
    if (!selectedStart || top) {
      setDetail(null);
      return;
    }
    const ctrl = new AbortController();
    setDetail({ status: 'loading' });
    fetch(`/api/search/${encodeURIComponent(searchId)}/window?style=${style.style}&start=${selectedStart}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as WindowDetail;
        setDetail({ status: 'ok', detail: d });
        onSelect(selectedStart, d.window.total);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setDetail({ status: 'error' });
      });
    return () => ctrl.abort();
  }, [searchId, style.style, selectedStart, top, attempt]);

  const selectedWindow = top ?? (detail?.status === 'ok' ? detail.detail.window : null);
  const reasons = top?.reasons ?? (detail?.status === 'ok' ? detail.detail.reasons : []);

  return (
    <div className="space-y-3.5">
      {dates.peakWarning && <PeakWarning warning={dates.peakWarning} destinationMonth={monthLabel(month, locale, 'long')} />}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <h2 className="text-[15px] font-bold">{t('calendarTitle', { month: monthLabel(month, locale, 'long') })}</h2>
            <span className="text-xs text-muted">{t('calendarSub', { plan: t(`plans.${style.style}.name`), people })}</span>
          </div>
          <PriceCalendar
            year={dates.year}
            month={dates.month}
            days={dates.days}
            style={style}
            selectedStart={selectedStart}
            onSelect={(s) => onSelect(s, style.top.find((w) => w.start === s)?.total ?? null)}
          />
        </section>

        <div className="space-y-3.5">
          <TopWindows style={style} selectedStart={selectedStart} onSelect={(s, total) => onSelect(s, total)} />
          <WhyDates events={dates.events} mostExpensive={style.mostExpensive} />
        </div>
      </div>

      {selectedStart && !selectedWindow && detail?.status === 'loading' && <SkeletonBlock label={t('pricingDates')} className="h-40" />}
      {selectedStart && !selectedWindow && detail?.status === 'error' && <SectionError onRetry={() => setAttempt((n) => n + 1)} />}
      {selectedWindow && (
        <WindowDetailCard
          window={selectedWindow}
          fetchedAt={style.fetchedAt}
          people={people}
          rank={top?.rank}
          saving={top?.saving}
          mostExpensive={style.mostExpensive}
          estimate={detail?.status === 'ok' ? detail.detail.estimate : undefined}
          reasons={reasons}
        />
      )}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <MonthCompare months={dates.months} chosen={dates.month} alternative={dates.bestAlternative} />
        {dates.bookingAdvice && selectedStart && (
          <BookingAdvice advice={dates.bookingAdvice} start={selectedStart} isPeakMonth={!!dates.peakWarning?.isPeakMonth} />
        )}
      </div>
    </div>
  );
}
