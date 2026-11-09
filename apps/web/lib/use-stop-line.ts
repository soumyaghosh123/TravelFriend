'use client';

import type { Attraction, PlanBase, PlannedDay, PricedWindow } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import { hm } from './transport-match';

export interface StopLine {
  icon: string;
  what: string;
  how: string;
}

export const CATEGORY_ICON: Record<string, string> = {
  beach: '🏖️',
  fort: '🏰',
  market: '🛍️',
  religious: '⛪',
  heritage: '🏛️',
  museum: '🖼️',
  nature: '🌿',
  village: '🏡',
  adventure: '🧗',
  culture: '🎭',
};

/**
 * Words for each stop of a day, shared by the Day-by-day tab, the printable plan (PDF) and the
 * calendar file, so all three say the same thing.
 */
export interface StopContext {
  attractions: Record<string, Attraction>;
  bases: PlanBase[];
  window: PricedWindow;
  arrivalPoint: string;
  departurePoint: string;
}

type Translate = ReturnType<typeof useTranslations>;

/** Same as `useStopLine`, for code that loops over days (calendar export). */
export function makeStopLine(
  t: Translate,
  tr: Translate,
  d: PlannedDay,
  ctx: StopContext,
): (s: PlannedDay['stops'][number]) => StopLine {
  const { attractions, window: w, arrivalPoint, departurePoint } = ctx;
  const base = ctx.bases.find((b) => b.id === d.baseId);
  return (s) => {
    const a = s.attractionId ? attractions[s.attractionId] : undefined;
    const travel = s.travelMin
      ? t('travelLeg', { min: s.travelMin, km: Math.round(s.distanceKm ?? 0) })
      : null;
    switch (s.kind) {
      case 'visit':
        return {
          icon: CATEGORY_ICON[a?.category ?? ''] ?? '📍',
          what: a?.name ?? s.attractionId ?? '',
          how: [
            t('visitFor', hm(s.durationMin)),
            travel,
            a?.warnings?.road,
            a?.warnings?.network,
            a?.warnings?.permit,
          ]
            .filter(Boolean)
            .join(' · '),
        };
      case 'journey': {
        const leg = d.date <= w.onward.arriveDate ? w.onward : w.return;
        return {
          icon: leg.mode === 'flight' ? '✈️' : leg.mode === 'bus' ? '🚌' : '🚆',
          what: t('onBoard', { mode: tr(`modes.${leg.mode}`), service: leg.number ?? leg.operator }),
          how: leg.travelClass,
        };
      }
      case 'to-hotel':
        return {
          icon: '🚕',
          what: t('toHotel', { from: arrivalPoint }),
          how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }),
        };
      case 'check-in':
        return { icon: '🏨', what: t('checkIn', { place: base?.name ?? '' }), how: base?.hotel?.name ?? '' };
      case 'check-out':
        return { icon: '🧳', what: t('checkOut'), how: '' };
      case 'move-base':
        return {
          icon: '🚌',
          what: t('moveBase', { to: base?.name ?? '' }),
          how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }),
        };
      case 'back-to-hotel':
        return {
          icon: '↩️',
          what: t('backToHotel'),
          how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }),
        };
      case 'to-station':
        return {
          icon: '🚉',
          what: t('toStation', { to: departurePoint }),
          how: t('travelLeg', { min: s.durationMin, km: Math.round(s.distanceKm ?? 0) }),
        };
      case 'free':
        return { icon: '☀️', what: t('freeDay'), how: t('freeDayHow') };
    }
  };
}

export function useStopLine(d: PlannedDay, ctx: StopContext): (s: PlannedDay['stops'][number]) => StopLine {
  const t = useTranslations('results.plan');
  const tr = useTranslations('results');
  return makeStopLine(t, tr, d, ctx);
}
