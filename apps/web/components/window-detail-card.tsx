'use client';

import type { WindowReason } from '@tripsaver/domain';
import type { PricedWindow, TransportOffer } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { dateRange, dayMonth, inr } from '../lib/format';
import { tripSources } from '../lib/trip-sources';
import { Price } from './price';
import { ReasonText } from './reason-text';

interface Props {
  window: PricedWindow;
  fetchedAt: string;
  people: number;
  rank?: number;
  saving?: number;
  mostExpensive: PricedWindow | null;
  /** Calendar estimate for this start date (only for dates outside the top 3). */
  estimate?: number;
  reasons: WindowReason[];
}

const MODE_ICON = { train: '🚆', bus: '🚌', flight: '✈️' } as const;

function Row({
  icon,
  title,
  sub,
  price,
}: {
  icon: string;
  title: ReactNode;
  sub: ReactNode;
  price: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-dashed border-line py-2.5 last:border-0 sm:flex-row sm:items-start sm:gap-3">
      <span className="hidden text-lg sm:block" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted">{sub}</div>
      </div>
      <div className="sm:w-56 sm:shrink-0 sm:text-right">{price}</div>
    </li>
  );
}

/** The selected dates, priced with the actual offers to book: each line has its own source and link. */
export function WindowDetailCard({
  window: w,
  fetchedAt,
  people,
  rank,
  saving,
  mostExpensive,
  estimate,
  reasons,
}: Props) {
  const t = useTranslations('results');
  const locale = useLocale();

  const leg = (o: TransportOffer, label: string) => (
    <Row
      icon={MODE_ICON[o.mode]}
      title={
        <>
          {label}: {t(`modes.${o.mode}`)} · {o.number ?? o.operator} · {o.travelClass}
        </>
      }
      sub={t('legTimes', {
        depart: `${dayMonth(o.departDate, locale)} ${o.departAt.slice(11, 16)}`,
        from: o.fromPoint,
        arrive: `${dayMonth(o.arriveDate, locale)} ${o.arriveAt.slice(11, 16)}`,
        to: o.toPoint,
      })}
      price={<Price amount={o.price.amount} isEstimate={o.isEstimate} offer={o} size="md" />}
    />
  );

  return (
    <section className="rounded-card bg-white p-4 shadow-card" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">
            {rank ? t('windowRank', { rank }) : t('windowSelected')} · {dateRange(w.start, w.end, locale)}
          </h2>
          <p className="text-xs text-muted">
            {t('windowStay', { days: w.daysAtDestination, nights: w.hotelNights })}
          </p>
          {saving !== undefined && saving > 0 && mostExpensive && (
            <p className="text-xs font-semibold text-good">
              {t('saveVs', {
                amount: inr(saving),
                dates: dateRange(mostExpensive.start, mostExpensive.end, locale),
              })}
            </p>
          )}
        </div>
        <Price
          amount={w.total}
          isEstimate
          size="lg"
          sources={tripSources(w, fetchedAt)}
          note={t('forGroup', { people, perPerson: inr(w.perPerson) })}
        />
      </div>

      <ul className="mt-2">
        {leg(w.onward, t('onward'))}
        {w.hotel ? (
          <Row
            icon="🏨"
            title={`${w.hotel.name} · ${'★'.repeat(w.hotel.stars)}`}
            sub={t('hotelLine', {
              rating: w.hotel.guestRating.toFixed(1),
              reviews: w.hotel.reviewCount,
              nights: w.hotel.nights,
            })}
            price={
              <Price
                amount={w.hotel.cheapest.price.amount}
                isEstimate={w.hotel.cheapest.isEstimate}
                offer={w.hotel.cheapest}
                size="md"
              />
            }
          />
        ) : (
          <Row icon="🏨" title={t('noHotel')} sub={t('noHotelSub')} price={null} />
        )}
        <Row
          icon="🍽️"
          title={t('localLine')}
          sub={t('localSub', { perDay: inr(w.local.perDay), days: w.local.days })}
          price={<Price amount={w.local.amount} isEstimate ownEstimate size="md" />}
        />
        {leg(w.return, t('return'))}
      </ul>

      {estimate !== undefined && estimate !== w.total && (
        <p className="mt-2 text-xs text-muted">{t('estimateNote', { estimate: inr(estimate) })}</p>
      )}

      {reasons.length > 0 && (
        <div className="mt-3 rounded-[10px] bg-bg px-3 py-2">
          <h3 className="text-xs font-bold">{t('windowWhy')}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-[18px] text-xs">
            {reasons.map((r, i) => (
              <li key={i}>
                <ReasonText reason={r} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
