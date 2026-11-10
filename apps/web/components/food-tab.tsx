'use client';

import {
  rankRestaurants,
  restaurantsForDish,
  typicalCostForTwo,
  type FoodPref,
  type PlanStyle,
} from '@tripsaver/domain';
import {
  googleMapsUrl,
  type DestinationGuide,
  type GuideSection,
  type HotelListing,
} from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { checkedAgo } from '../lib/format';
import type { GuideAnchor } from '../lib/guide-anchor';
import { GuideFootnote } from './guide-footnote';
import { Price } from './price';

interface Props {
  guide: GuideSection;
  /** The curated guide (dishes, sample places); null where we haven't written one yet. */
  content: DestinationGuide | null;
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
  unknown: 'bg-bg text-ink2',
} as const;
const MAX_PLACES = 6;

/** Tab 7 "Food" (brief §3.6): dishes to try and where, places to eat for this plan, and food at your hotel. */
export function FoodTab({ guide, content, anchor, style, food, hotel }: Props) {
  const t = useTranslations('results.food');
  const tg = useTranslations('results.guide');
  const tp = useTranslations('price');
  const locale = useLocale();
  const veg = food === 'veg' || food === 'jain';
  const eateries = guide.restaurants;
  const allDishes = content?.dishes ?? [];
  const dishes = veg ? allDishes.filter((d) => d.vegType === 'veg') : allDishes;
  const places = rankRestaurants(eateries.list, anchor, style, food).slice(0, MAX_PLACES);
  const samples = content?.restaurants ?? [];

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5 lg:grid-cols-2">
        {content && (
          <section className="rounded-card bg-white p-4 shadow-card">
            <h3 className="font-bold">{t('dishesTitle', { name: guide.destination.name })}</h3>
            <ul className="mt-1">
              {dishes.map((d) => {
                // Real places don't say which dishes they're known for: "try it at" is for sample places only.
                const where = eateries.live
                  ? undefined
                  : restaurantsForDish(eateries.list, d.id, anchor).filter(
                      (r) => !veg || r.vegType !== 'non-veg',
                    )[0];
                return (
                  <li
                    key={d.id}
                    className="flex gap-3 border-b border-dashed border-line py-2.5 last:border-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <b>{d.name}</b>
                        <span
                          className={`rounded px-1.5 py-px text-[11px] font-bold ${VEG_BADGE[d.vegType]}`}
                        >
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
        )}

        <div className="space-y-3.5">
          <section className="rounded-card bg-white p-4 shadow-card">
            <h3 className="font-bold">{t('whereTitle', { name: anchor.name })}</h3>
            <p className="text-xs text-muted">
              {t(`planNote.${style}`)}
              {veg && <> {t('vegNote')}</>}
            </p>
            {!eateries.live && eateries.realProvider && (
              <p className="mt-1 text-xs font-semibold text-warn">{t('liveUnavailable')}</p>
            )}
            {places.length === 0 && (
              <p className="mt-2 text-sm text-muted">{t('noPlaces', { name: anchor.name })}</p>
            )}
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
                      {[
                        t(`kind.${r.kind}`),
                        r.cuisine?.slice(0, 2).join(', '),
                        r.area,
                        tg('distance', { km: Math.round(r.distanceKm * 10) / 10 }),
                        r.hours,
                        r.note,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    {r.live && (
                      <a
                        href={googleMapsUrl(r.lat, r.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand underline"
                      >
                        {t('openInMaps')}
                      </a>
                    )}
                  </div>
                  <div className="w-32 shrink-0 text-right">
                    {/* A real place has no price of its own: the typical cost for its kind, as our estimate. */}
                    <Price
                      amount={r.costForTwo ?? typicalCostForTwo(r.kind, samples)}
                      isEstimate
                      ownEstimate
                      size="sm"
                      note={r.costForTwo === undefined ? t('typicalForTwo') : t('forTwo')}
                    />
                    {r.rating !== undefined && (
                      <div className="text-[11px] text-muted">
                        {t('rating', {
                          rating: r.rating.toFixed(1),
                          count: (r.reviewCount ?? 0).toLocaleString('en-IN'),
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {eateries.live && eateries.source && (
              <p className="mt-2 text-[11px] text-muted">
                <a href={eateries.source.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {t('osmCredit')}
                </a>
                {eateries.fetchedAt && (
                  <> · {tp('checked', { ago: checkedAgo(eateries.fetchedAt, Date.now(), locale) })}</>
                )}
              </p>
            )}
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
