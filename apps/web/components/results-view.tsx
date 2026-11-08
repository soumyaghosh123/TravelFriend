'use client';

import type { ValidSearchInput } from '@tripsaver/domain';
import type { StyleDates, TripStyle } from '@tripsaver/providers';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { dateRange, monthLabel } from '../lib/format';
import { useResultsStream } from '../lib/use-results-stream';
import { BestDatesTab } from './best-dates-tab';
import { DestinationBanner } from './destination-banner';
import { PlanCards } from './plan-cards';
import { Price } from './price';
import { ResultTabs } from './result-tabs';
import { SectionError } from './section-error';
import { SkeletonBlock } from './skeleton-block';
import { tripSources } from '../lib/trip-sources';

interface Props {
  searchId: string;
  input: ValidSearchInput;
  fromName: string;
  toName: string;
  toKind: 'city' | 'region';
  changeHref: string;
}

/** Results page body: sticky summary, destination banner, plan cards and the 10 tabs (PLAN §9). */
export function ResultsView({ searchId, input, fromName, toName, toKind, changeHref }: Props) {
  const t = useTranslations('results');
  const ts = useTranslations('search');
  const locale = useLocale();
  const { dates, retry } = useResultsStream(searchId);
  const [style, setStyle] = useState<TripStyle>('budget');
  const [start, setStart] = useState<string | null>(null);
  const [selectedTotal, setSelectedTotal] = useState<number | null>(null);

  const styles = dates.status === 'ok' ? dates.data.styles : [];
  const current: StyleDates | undefined = styles.find((s) => s.style === style);
  const best = current?.top[0];

  // Pick the cheapest window whenever results arrive or the plan changes.
  useEffect(() => {
    setStart(best?.start ?? null);
    setSelectedTotal(best?.total ?? null);
  }, [best?.start, best?.total]);

  const people = input.travellers.adults + input.travellers.childAges.length;
  const selected = current && start ? current.cells.find((c) => c.start === start) : undefined;

  return (
    <>
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-white px-3.5 py-2.5 md:gap-4 md:px-6">
        <div className="min-w-0">
          <div className="text-[15px] font-bold">
            {fromName} → {toName} · {t('days', { days: input.days })}
          </div>
          <div className="text-[13px] text-muted">
            {ts('travellersSummary', { adults: input.travellers.adults, children: input.travellers.childAges.length })}
            {input.travellers.childAges.length > 0 &&
              ` (${input.travellers.childAges.map((a) => ts('ageYears', { age: a })).join(', ')})`}{' '}
            · {ts('roomsSummary', { rooms: input.travellers.rooms })} · {monthLabel(input.month, locale)}
          </div>
        </div>
        {selected && best && (
          <span className="rounded-full bg-good-l px-3 py-1 text-[13px] font-semibold text-good">
            {selected.start === best.start ? '★ ' + t('cheapestDates') : t('selectedDates')}: {dateRange(selected.start, selected.end, locale)}
          </span>
        )}
        <Link href={changeHref} className="rounded-full border border-line bg-white px-3 py-1.5 font-medium text-ink2 hover:border-brand">
          {t('changeSearch')}
        </Link>
        <div className="flex-1" />
        {current && best && selectedTotal !== null && (
          <div className="hidden text-right md:block">
            <Price amount={selectedTotal} isEstimate sources={tripSources(best, current.fetchedAt)} size="md" note={t(`planTotal.${style}`)} />
          </div>
        )}
      </div>

      <DestinationBanner code={input.to} name={toName} kind={toKind} month={input.month} climate={dates.status === 'ok' ? dates.data.climate : null} />

      <main className="mx-auto max-w-[1232px] px-3 pb-8 pt-[18px] md:px-6">
        {dates.status === 'loading' && <SkeletonBlock label={t('loading')} className="h-[188px]" />}
        {dates.status === 'error' && <SectionError onRetry={retry} />}
        {dates.status === 'ok' && <PlanCards styles={styles} selected={style} onSelect={setStyle} people={people} />}

        <ResultTabs active="dates" />

        {dates.status === 'loading' && <SkeletonBlock label={t('loading')} className="h-[420px]" />}
        {dates.status === 'ok' && current && (
          <BestDatesTab
            searchId={searchId}
            dates={dates.data}
            style={current}
            people={people}
            selectedStart={start}
            onSelect={(s, total) => {
              setStart(s);
              setSelectedTotal(total);
            }}
          />
        )}
        {dates.status === 'ok' && !current && <SectionError onRetry={retry} />}
      </main>
    </>
  );
}
