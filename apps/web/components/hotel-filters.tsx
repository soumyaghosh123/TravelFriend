'use client';

import type { HotelFilters as Filters, HotelSort } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';
import { useId } from 'react';
import { Chip } from './chip';

interface Props {
  filters: Filters;
  sort: HotelSort;
  landmark: string | null;
  onFilters: (f: Filters) => void;
  onSort: (s: HotelSort) => void;
}

const SORTS: HotelSort[] = ['cheapest', 'nearest', 'value', 'rating'];
const AMENITIES = ['Pool', 'Parking', 'Couple-friendly'] as const;
const MAX_PER_NIGHT = [2000, 5000, 10000] as const;
const NEAR_KM = 2;

/** Sort and filters for the hotel lists (brief §3.1). */
export function HotelFiltersBar({ filters: f, sort, landmark, onFilters, onSort }: Props) {
  const t = useTranslations('results.hotels');
  const sortId = useId();
  const priceId = useId();
  const toggleAmenity = (a: string) => {
    const now = f.amenities ?? [];
    onFilters({ ...f, amenities: now.includes(a) ? now.filter((x) => x !== a) : [...now, a] });
  };
  const select = 'rounded-full border border-line bg-white px-2.5 py-1 text-[13px]';

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <label htmlFor={sortId} className="sr-only">
        {t('sortLabel')}
      </label>
      <select
        id={sortId}
        className={select}
        value={sort}
        onChange={(e) => onSort(e.target.value as HotelSort)}
      >
        {SORTS.map((s) => (
          <option key={s} value={s} disabled={s === 'nearest' && !landmark}>
            {t(`sort.${s}`)}
          </option>
        ))}
      </select>
      <label htmlFor={priceId} className="sr-only">
        {t('maxPerNightLabel')}
      </label>
      <select
        id={priceId}
        className={select}
        value={f.maxPerNight ?? ''}
        onChange={(e) =>
          onFilters({ ...f, maxPerNight: e.target.value ? Number(e.target.value) : undefined })
        }
      >
        <option value="">{t('anyPrice')}</option>
        {MAX_PER_NIGHT.map((p) => (
          <option key={p} value={p}>
            {t('maxPerNight', { price: `₹${p.toLocaleString('en-IN')}` })}
          </option>
        ))}
      </select>
      <Chip
        on={f.minRating === 3.5}
        onToggle={() => onFilters({ ...f, minRating: f.minRating === 3.5 ? undefined : 3.5 })}
      >
        {t('rating35')}
      </Chip>
      <Chip
        on={!!f.freeCancellation}
        onToggle={() => onFilters({ ...f, freeCancellation: !f.freeCancellation })}
      >
        {t('freeCancellation')}
      </Chip>
      <Chip on={!!f.breakfast} onToggle={() => onFilters({ ...f, breakfast: !f.breakfast })}>
        {t('breakfast')}
      </Chip>
      {AMENITIES.map((a) => (
        <Chip key={a} on={!!f.amenities?.includes(a)} onToggle={() => toggleAmenity(a)}>
          {t(`amenity.${a}`)}
        </Chip>
      ))}
      {landmark && (
        <Chip
          on={f.maxDistanceKm === NEAR_KM}
          onToggle={() =>
            onFilters({ ...f, maxDistanceKm: f.maxDistanceKm === NEAR_KM ? undefined : NEAR_KM })
          }
        >
          {t('near', { km: NEAR_KM, landmark })}
        </Chip>
      )}
    </div>
  );
}
