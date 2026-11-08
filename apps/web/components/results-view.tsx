'use client';

import type { ValidSearchInput } from '@tripsaver/domain';
import type { StyleDates, TripStyle } from '@tripsaver/providers';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { dateRange, monthLabel } from '../lib/format';
import { tripSources } from '../lib/trip-sources';
import { useResultsStream } from '../lib/use-results-stream';
import { useSelectedWindow } from '../lib/use-selected-window';
import { useHotels, useTransport } from '../lib/use-transport';
import { BestDatesTab } from './best-dates-tab';
import { DestinationBanner } from './destination-banner';
import { GettingThereTab } from './getting-there-tab';
import { HotelsTab } from './hotels-tab';
import { PlanCards } from './plan-cards';
import { Price } from './price';
import { panelId, ResultTabs, tabId, type TabId } from './result-tabs';
import { SectionError } from './section-error';
import { SkeletonBlock } from './skeleton-block';

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
  const { dates, transport: streamedTransport, hotels: streamedHotels, retry } = useResultsStream(searchId);
  const [tab, setTab] = useState<TabId>('dates');
  const [style, setStyle] = useState<TripStyle>('budget');
  const [start, setStart] = useState<string | null>(null);

  const styles = dates.status === 'ok' ? dates.data.styles : [];
  const current: StyleDates | undefined = styles.find((s) => s.style === style);
  const best = current?.top[0];

  // Pick the plan's cheapest window whenever results arrive or the plan changes.
  useEffect(() => setStart(best?.start ?? null), [best?.start]);

  const selection = useSelectedWindow(searchId, current, start);
  const transport = useTransport(searchId, selection.window, streamedTransport);
  const hotels = useHotels(searchId, selection.window, streamedHotels);
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
        {current && selection.window && (
          <div className="hidden text-right md:block">
            <Price
              amount={selection.window.total}
              isEstimate
              sources={tripSources(selection.window, current.fetchedAt)}
              size="md"
              note={t(`planTotal.${style}`)}
            />
          </div>
        )}
      </div>

      <DestinationBanner code={input.to} name={toName} kind={toKind} month={input.month} climate={dates.status === 'ok' ? dates.data.climate : null} />

      <main className="mx-auto max-w-[1232px] px-3 pb-8 pt-[18px] md:px-6">
        {dates.status === 'loading' && <SkeletonBlock label={t('loading')} className="h-[188px]" />}
        {dates.status === 'error' && <SectionError onRetry={retry} />}
        {dates.status === 'ok' && <PlanCards styles={styles} selected={style} onSelect={setStyle} people={people} />}

        <ResultTabs active={tab} onChange={setTab} />

        <div role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)}>
          {dates.status === 'loading' && <SkeletonBlock label={t('loading')} className="h-[420px]" />}
          {dates.status === 'ok' && !current && <SectionError onRetry={retry} />}

          {tab === 'dates' && dates.status === 'ok' && current && (
            <BestDatesTab dates={dates.data} style={current} people={people} selectedStart={start} selection={selection} onSelect={setStart} />
          )}

          {tab === 'getting' && dates.status === 'ok' && current && (
            <>
              {(transport.status === 'loading' || selection.status === 'loading') && <SkeletonBlock label={t('transport.loading')} className="h-[420px]" />}
              {(transport.status === 'error' || selection.status === 'error') && (
                <SectionError onRetry={selection.status === 'error' ? selection.retry : transport.retry} />
              )}
              {transport.status === 'ok' && selection.window && (
                <GettingThereTab transport={transport.data} window={selection.window} style={style} people={people} />
              )}
            </>
          )}

          {tab === 'hotels' && dates.status === 'ok' && current && (
            <>
              {(hotels.status === 'loading' || selection.status === 'loading') && <SkeletonBlock label={t('hotels.loading')} className="h-[420px]" />}
              {(hotels.status === 'error' || selection.status === 'error') && (
                <SectionError onRetry={selection.status === 'error' ? selection.retry : hotels.retry} />
              )}
              {hotels.status === 'ok' && selection.window && (
                <HotelsTab section={hotels.data} window={selection.window} style={style} chosenTypes={input.hotelTypes} />
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}
