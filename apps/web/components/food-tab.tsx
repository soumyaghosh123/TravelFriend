'use client';

import { rankRestaurants, restaurantsForDish, type FoodPref, type PlanStyle } from '@tripsaver/domain';
import type { DestinationGuide, GuideSection, HotelListing } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import type { GuideAnchor } from '../lib/guide-anchor';
import { GuideFootnote } from './guide-footnote';
import { Price } from './price';

interface Props {
  guide: GuideSection;
  content: DestinationGuide;
  anchor: GuideAnchor;
  style: PlanStyle;
  food: FoodPref;
  /** The plan's hotel at this base, for "Food at your hotel". */
  hotel?: HotelListing | null;
}

const VEG_BADGE = {
  veg: 'bg-good-l text-good',
  egg: 'bg-warn-l text-warn',
  'non-veg': 'bg-bad-l text-bad',
  both: 'bg-bg text-ink2',
} as const;
const MAX_PLACES = 6;

/** Tab 7 "Food" (brief §3.6): dishes to try and where, places to eat for this plan, and food at your hotel. */
export function FoodTab({ guide, content, anchor, style, food, hotel }: Props) {
  const t = useTranslations('results.food');
  const tg = useTranslations('results.guide');
  const veg = food === 'veg' || food === 'jain';
  const dishes = veg ? content.dishes.filter((d) => d.vegType === 'veg') : content.dishes;
  const places = rankRestaurants(content.restaurants, anchor, style, food).slice(0, MAX_PLACES);

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className="rounded-card bg-white p-4 shadow-card">
          <h3 className="font-bold">{t('dishesTitle', { name: guide.destination.name })}</h3>
          <ul className="mt-1">
            {dishes.map((d) => {
              const where = restaurantsForDish(content.restaurants, d.id, anchor).filter(
                (r) => !veg || r.vegType !== 'non-veg',
              )[0];
              return (
                <li key={d.id} className="flex gap-3 border-b border-dashed border-line py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <b>{d.name}</b>
                      <span className={`rounded px-1.5 py-px text-[11px] font-bold ${VEG_BADGE[d.vegType]}`}>
                        {t(`veg.${d.vegType}`)}
                      </span>
                    </div>
                    <p className="text-xs text-ink2">{d.description}</p>
                    {where && (
                      <p className="text-xs text-muted">
                        {t('tryAt', { place: where.name, km: Math.round(where.distanceKm) })}
                      </p>
                    )}
                  </div>
                  <div className="w-32 shrink-0 text-right">
                    <Price
                      amount={d.priceMin}
                      amountMax={d.priceMax}
                      isEstimate
                      ownEstimate
                      size="sm"
                      note={d.unit ? t('perUnit', { unit: d.unit }) : t('perPlate')}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-3.5">
          <section className="rounded-card bg-white p-4 shadow-card">
            <h3 className="font-bold">{t('whereTitle', { name: anchor.name })}</h3>
            <p className="text-xs text-muted">
              {t(`planNote.${style}`)}
              {veg && <> {t('vegNote')}</>}
            </p>
            <ul className="mt-1">
              {places.map((r) => (
                <li key={r.id} className="flex gap-3 border-b border-dashed border-line py-2.5 last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <b>{r.name}</b>
                      <span className={`rounded px-1.5 py-px text-[11px] font-bold ${VEG_BADGE[r.vegType]}`}>
                        {t(`placeVeg.${r.vegType}`)}
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {t(`kind.${r.kind}`)} · {r.area} ·{' '}
                      {tg('distance', { km: Math.round(r.distanceKm * 10) / 10 })} · {r.hours}
                      {r.note && <> · {r.note}</>}
                    </p>
                  </div>
                  <div className="w-32 shrink-0 text-right">
                    <Price amount={r.costForTwo} isEstimate ownEstimate size="sm" note={t('forTwo')} />
                    <div className="text-[11px] text-muted">
                      {t('rating', {
                        rating: r.rating.toFixed(1),
                        count: r.reviewCount.toLocaleString('en-IN'),
                      })}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {hotel && (
            <section className="rounded-card bg-white p-4 shadow-card">
              <h3 className="font-bold">{t('hotelTitle', { name: hotel.name })}</h3>
              <p className="text-sm">
                {hotel.breakfastIncluded ? t('breakfastIncluded') : t('breakfastNotIncluded')}
              </p>
              {hotel.restaurant ? (
                <div className="mt-1.5 flex flex-wrap gap-4">
                  <Price
                    amount={hotel.restaurant.costForTwo}
                    isEstimate
                    ownEstimate
                    size="sm"
                    note={t('hotelMeal')}
                  />
                  {!hotel.breakfastIncluded && hotel.restaurant.breakfastPerPerson !== undefined && (
                    <Price
                      amount={hotel.restaurant.breakfastPerPerson}
                      isEstimate
                      ownEstimate
                      size="sm"
                      note={t('hotelBreakfast')}
                    />
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted">{t('hotelNoRestaurant')}</p>
              )}
            </section>
          )}
        </div>
      </div>
      <GuideFootnote guide={guide} anchor={anchor} />
    </div>
  );
}
