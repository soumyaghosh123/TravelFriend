'use client';

import type { Slot } from '@tripsaver/domain';
import type { Attraction, PlanBase, PlannedDay, PricedWindow } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { inr } from '../lib/format';
import { hm } from '../lib/transport-match';
import { Price } from './price';

interface Props {
  day: PlannedDay;
  attractions: Record<string, Attraction>;
  bases: PlanBase[];
  window: PricedWindow;
  arrivalPoint: string;
  departurePoint: string;
}

const SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];
const CATEGORY_ICON: Record<string, string> = {
  beach: '🏖️', fort: '🏰', market: '🛍️', religious: '⛪', heritage: '🏛️', museum: '🖼️', nature: '🌿',
  village: '🏡', adventure: '🧗', culture: '🎭',
};

/** One day: header with spend and active hours, then morning / afternoon / evening, then tonight's hotel. */
export function ItineraryDay({ day: d, attractions, bases, window: w, arrivalPoint, departurePoint }: Props) {
  const t = useTranslations('results.plan');
  const tr = useTranslations('results');
  const locale = useLocale();
  const date = new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : `${locale}-IN`, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${d.date}T00:00:00Z`),
  );
  const base = bases.find((b) => b.id === d.baseId);
  const night = bases.find((b) => b.id === d.nightAt);
  const active = hm(d.activeMin);

  const line = (s: PlannedDay['stops'][number]) => {
    const a = s.attractionId ? attractions[s.attractionId] : undefined;
    const travel = s.travelMin ? t('travelLeg', { min: s.travelMin, km: Math.round(s.distanceKm ?? 0) }) : null;
    switch (s.kind) {
      case 'visit':
        return {
          icon: CATEGORY_ICON[a?.category ?? ''] ?? '📍',
          what: a?.name ?? s.attractionId,
          how: [t('visitFor', hm(s.durationMin)), travel, a?.warnings?.road, a?.warnings?.network, a?.warnings?.permit].filter(Boolean).join(' · '),
        };
      case 'journey': {
        const leg = d.date <= w.onward.arriveDate ? w.onward : w.return;
        return { icon: leg.mode === 'flight' ? '✈️' : leg.mode === 'bus' ? '🚌' : '🚆', what: t('onBoard', { mode: tr(`modes.${leg.mode}`), service: leg.number ?? leg.operator }), how: leg.travelClass };
      }
      case 'to-hotel':
        return { icon: '🚕', what: t('toHotel', { from: arrivalPoint }), how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }) };
      case 'check-in':
        return { icon: '🏨', what: t('checkIn', { place: base?.name ?? '' }), how: base?.hotel?.name ?? '' };
      case 'check-out':
        return { icon: '🧳', what: t('checkOut'), how: '' };
      case 'move-base':
        return { icon: '🚌', what: t('moveBase', { to: base?.name ?? '' }), how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }) };
      case 'back-to-hotel':
        return { icon: '↩️', what: t('backToHotel'), how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }) };
      case 'to-station':
        return { icon: '🚉', what: t('toStation', { to: departurePoint }), how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }) };
      case 'free':
        return { icon: '☀️', what: t('freeDay'), how: t('freeDayHow') };
    }
  };

  const tone = d.kind === 'travel' ? 'border-[#c7d2fe] bg-[#eef2ff]' : d.kind === 'free' ? 'border-[#fde68a] bg-accent-l' : 'border-line bg-bg';

  return (
    <article className="grid grid-cols-1 gap-3.5 border-b border-line py-3.5 last:border-0 md:grid-cols-[150px_1fr]">
      <header>
        <b className="block text-[15px]">{t('dayN', { n: d.index })}</b>
        <small className="text-muted">
          {date} · {t(`kind.${d.kind}`)}
        </small>
        <div className="mt-1.5">
          <Price
            amount={d.spend.total}
            isEstimate
            ownEstimate
            size="sm"
            note={t('spendNote', { entry: inr(d.spend.entry), local: inr(d.spend.local), meals: inr(d.spend.meals) })}
          />
        </div>
        <div className="text-[11px] text-muted">{d.activeMin > 0 ? t('active', active) : t('activeNone')}</div>
      </header>

      <div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {SLOTS.map((slot) => {
            const stops = d.stops.filter((s) => (slot === 'evening' ? s.slot === 'evening' || s.slot === 'night' : s.slot === slot));
            return (
              <div key={slot} className={`rounded-[10px] border px-2.5 py-2 ${tone}`}>
                <div className="text-[10px] font-bold uppercase tracking-[.06em] text-muted">{t(`slot.${slot}`)}</div>
                {stops.length === 0 ? (
                  <div className="text-xs text-muted">—</div>
                ) : (
                  <ul className="space-y-1.5">
                    {stops.map((s, i) => {
                      const l = line(s);
                      return (
                        <li key={i}>
                          <div className="font-semibold">
                            <span aria-hidden>{l.icon} </span>
                            {s.kind !== 'journey' && s.kind !== 'free' && <span className="mr-1 tabular-nums text-muted">{s.start}</span>}
                            {l.what}
                          </div>
                          {l.how && <div className="text-xs text-ink2">{l.how}</div>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {night && (night.hotel || night.fiveStar) && (
          <div className="mt-2 flex flex-wrap items-start gap-x-6 gap-y-2 text-xs text-ink2">
            {night.hotel && (
              <div className="flex flex-wrap items-center gap-1.5">
                🏨 {t('tonight')} <b>{night.hotel.name}</b> · {t('perNight')}
                <Price amount={night.hotel.perNight} isEstimate={night.hotel.cheapest.isEstimate} offer={night.hotel.cheapest} chip={{ highlight: true }} />
              </div>
            )}
            {night.fiveStar && night.fiveStar.hotelId !== night.hotel?.hotelId && (
              <div className="flex flex-wrap items-center gap-1.5">
                ✨ {t('orFiveStar')} <b>{night.fiveStar.name}</b> · {t('perNight')}
                <Price amount={night.fiveStar.perNight} isEstimate={night.fiveStar.cheapest.isEstimate} offer={night.fiveStar.cheapest} chip={{}} />
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
