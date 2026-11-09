'use client';

import type { HotelListing } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import { inr } from '../lib/format';
import { Price } from './price';

interface Props {
  hotel: HotelListing;
  landmark: string | null;
  inPlan?: string;
}

// Placeholder photo strips by type until licensed hotel photos are available (as in the mockup).
const PHOTO: Record<HotelListing['type'], string> = {
  budget: 'linear-gradient(135deg,#fcd34d,#f97316)',
  hostel: 'linear-gradient(135deg,#fde68a,#f59e0b)',
  '3star': 'linear-gradient(135deg,#7dd3fc,#0ea5e9)',
  '4star': 'linear-gradient(135deg,#86efac,#16a34a)',
  '5star': 'linear-gradient(135deg,#a5b4fc,#6366f1)',
  homestay: 'linear-gradient(135deg,#bef264,#65a30d)',
  resort: 'linear-gradient(135deg,#fda4af,#e11d48)',
};

/** One hotel (brief §3.1): ratings, distance, every site's price with the cheapest highlighted, and booking. */
export function HotelCard({ hotel: h, landmark, inPlan }: Props) {
  const t = useTranslations('results.hotels');
  const distance =
    h.distanceKm === null || !landmark
      ? null
      : h.distanceKm < 1
        ? t('distanceM', { m: Math.round((h.distanceKm * 1000) / 10) * 10, landmark })
        : t('distanceKm', { km: h.distanceKm.toFixed(1), landmark });
  const tags = [
    h.breakfastIncluded && t('breakfast'),
    h.freeCancellation && t('freeCancellation'),
    ...h.amenities.map((a) => (t.has(`amenity.${a}`) ? t(`amenity.${a}`) : a)),
  ].filter(Boolean);

  return (
    <article className="grid grid-cols-1 gap-3 border-b border-line py-3 last:border-0 sm:grid-cols-[110px_1fr]">
      <div
        className="hidden h-[100px] rounded-[10px] sm:block"
        style={{ background: PHOTO[h.type] }}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold">{h.name}</h3>
          {h.stars > 0 && (
            <span className="text-xs tracking-[1px] text-accent" aria-label={t('stars', { stars: h.stars })}>
              {'★'.repeat(h.stars)}
            </span>
          )}
          <span className="rounded-full bg-line px-2 py-px text-[11px] font-semibold text-ink2">
            {t(`type.${h.type}`)}
          </span>
          {inPlan && (
            <span className="rounded-full bg-brand px-2 py-px text-[11px] font-bold text-white">
              {t('inPlan', { plan: inPlan })}
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs">
          <b className="mr-1 rounded-md bg-good px-1.5 py-px text-white">{h.guestRating.toFixed(1)}</b>
          {t('reviews', { count: h.reviewCount })}
          {distance && <> · {distance}</>}
        </div>
        <div className="mt-0.5 text-xs text-muted">{tags.join(' · ')}</div>
        {h.restaurant && (
          <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
            {/* The hotel's restaurant prices, from the listing: typical figures, so marked approx. */}
            <Price
              amount={h.restaurant.costForTwo}
              isEstimate
              size="sm"
              note={t('restaurant')}
              sources={{ names: [h.cheapest.sourceName], fetchedAt: h.cheapest.fetchedAt }}
            />
            {h.restaurant.breakfastPerPerson !== undefined && (
              <Price
                amount={h.restaurant.breakfastPerPerson}
                isEstimate
                size="sm"
                note={t('breakfastPrice')}
                sources={{ names: [h.cheapest.sourceName], fetchedAt: h.cheapest.fetchedAt }}
              />
            )}
          </div>
        )}

        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('sitePrices')}>
          {h.sitePrices.map((p) => (
            <li key={p.site}>
              <Price
                amount={p.price.amount}
                isEstimate={p.isEstimate}
                offer={p}
                chip={{ highlight: p.site === h.cheapest.site }}
              />
            </li>
          ))}
        </ul>

        <div className="mt-2">
          <Price
            amount={h.totalPrice}
            isEstimate={h.cheapest.isEstimate}
            offer={h.cheapest}
            size="lg"
            note={[
              t('stay', { nights: h.nights, perNight: inr(h.perNight) }),
              t('rooms', { rooms: h.rooms }),
              h.extraBeds > 0 ? t('extraBeds', { beds: h.extraBeds }) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        </div>
      </div>
    </article>
  );
}
