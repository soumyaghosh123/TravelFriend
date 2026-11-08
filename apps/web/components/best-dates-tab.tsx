'use client';

import type { DatesSection, StyleDates } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { monthLabel } from '../lib/format';
import type { SelectedWindow } from '../lib/use-selected-window';
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
  dates: DatesSection;
  style: StyleDates;
  people: number;
  selectedStart: string | null;
  selection: SelectedWindow;
  onSelect: (start: string) => void;
}

/** Tab 1: price calendar, 3 cheapest windows, why dates cost more, month comparison, when to book. */
export function BestDatesTab({ dates, style, people, selectedStart, selection, onSelect }: Props) {
  const t = useTranslations('results');
  const locale = useLocale();
  const month = `${dates.year}-${String(dates.month).padStart(2, '0')}`;

  return (
    <div className="space-y-3.5">
      {dates.peakWarning && <PeakWarning warning={dates.peakWarning} destinationMonth={monthLabel(month, locale, 'long')} />}

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-card bg-white p-4 shadow-card">
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-1.5">
            <h2 className="text-[15px] font-bold">{t('calendarTitle', { month: monthLabel(month, locale, 'long') })}</h2>
            <span className="text-xs text-muted">{t('calendarSub', { plan: t(`plans.${style.style}.name`), people })}</span>
          </div>
          <PriceCalendar year={dates.year} month={dates.month} days={dates.days} style={style} selectedStart={selectedStart} onSelect={onSelect} />
        </section>

        <div className="space-y-3.5">
          <TopWindows style={style} selectedStart={selectedStart} onSelect={onSelect} />
          <WhyDates events={dates.events} mostExpensive={style.mostExpensive} />
        </div>
      </div>

      {selection.status === 'loading' && <SkeletonBlock label={t('pricingDates')} className="h-40" />}
      {selection.status === 'error' && <SectionError onRetry={selection.retry} />}
      {selection.window && (
        <WindowDetailCard
          window={selection.window}
          fetchedAt={style.fetchedAt}
          people={people}
          rank={selection.rank}
          saving={selection.saving}
          mostExpensive={style.mostExpensive}
          estimate={selection.estimate}
          reasons={selection.reasons}
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
