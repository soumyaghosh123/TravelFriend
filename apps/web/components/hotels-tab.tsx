'use client';

import type { HotelFilters, HotelSort, HotelType } from '@tripsaver/domain';
import type { HotelListing, HotelsSection, PricedWindow, TripStyle } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { dateRange } from '../lib/format';
import { DEFAULT_FILTERS, DEFAULT_SORT, hotelLists } from '../lib/hotel-lists';
import { HotelCard } from './hotel-card';
import { HotelFiltersBar } from './hotel-filters';

interface Props {
  section: HotelsSection;
  window: PricedWindow;
  style: TripStyle;
  chosenTypes: HotelType[];
}

/** Tab 4 "Hotels" (brief §3.1): the plan's stay, filters and sort, 3★+ and 5★ lists side by side. */
export function HotelsTab({ section: s, window: w, style, chosenTypes }: Props) {
  const t = useTranslations('results.hotels');
  const tr = useTranslations('results');
  const locale = useLocale();
  const [filters, setFilters] = useState<HotelFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<HotelSort>(DEFAULT_SORT);
  const planName = tr(`plans.${style}.name`);
  const landmark = s.landmark?.name ?? null;

  if (s.nights === 0) return <p className="rounded-card bg-white p-4 text-muted shadow-card">{t('noNights')}</p>;

  const lists = hotelLists(s.hotels, chosenTypes, filters, sort);
  const planHotel = w.hotel ? s.hotels.find((h) => h.hotelId === w.hotel!.hotelId) : undefined;

  const column = (key: 'threePlus' | 'fiveStar' | 'others', hotels: HotelListing[]) => (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h2 className="flex items-center gap-2 text-[15px] font-bold">
        {t(`lists.${key}`)}
        <span className="rounded-full bg-line px-2 py-px text-[11px] font-bold text-ink2">
          {t('count', { shown: hotels.length, total: lists.totals[key] })}
        </span>
      </h2>
      {hotels.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('noneMatch')}</p>
      ) : (
        hotels.map((h) => <HotelCard key={h.hotelId} hotel={h} landmark={landmark} inPlan={h.hotelId === planHotel?.hotelId ? planName : undefined} />)
      )}
    </section>
  );

  return (
    <div className="space-y-3.5">
      {planHotel && (
        <section className="rounded-card border-l-4 border-brand bg-white p-4 shadow-card">
          <span className="rounded-full bg-brand-l px-2 py-px text-[11px] font-bold uppercase text-brand-d">{t('planStay', { plan: planName })}</span>
          <HotelCard hotel={planHotel} landmark={landmark} />
        </section>
      )}

      <p className="text-sm text-ink2">
        {t('stayLine', {
          dates: dateRange(s.checkIn, s.checkOut, locale),
          nights: s.nights,
          rooms: s.rooms,
        })}
        {s.extraBeds > 0 && <> · {t('extraBedsNote', { beds: s.extraBeds })}</>}
        {s.landmark && !s.landmark.matched && <> · {t('landmarkFallback', { landmark: s.landmark.name })}</>}
      </p>

      {s.priceHint && s.priceHint.level !== 'usual' && (
        <p className={`rounded-[10px] px-3 py-2 text-sm ${s.priceHint.level === 'lower' ? 'bg-good-l text-good' : 'bg-warn-l text-warn'}`}>
          {t(`hint.${s.priceHint.level}`, { pct: s.priceHint.pct })}
        </p>
      )}

      <HotelFiltersBar filters={filters} sort={sort} landmark={landmark} onFilters={setFilters} onSort={setSort} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        {column('threePlus', lists.threePlus)}
        {column('fiveStar', lists.fiveStar)}
      </div>
      {lists.totals.others > 0 && column('others', lists.others)}

      <p className="text-xs text-muted">
        {s.sampleData && <b className="text-warn">{t('sample')} </b>}
        {t('taxesNote')}
      </p>
    </div>
  );
}
