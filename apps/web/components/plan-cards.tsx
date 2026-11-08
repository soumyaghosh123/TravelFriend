'use client';

import type { StyleDates, TripStyle } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import { inr } from '../lib/format';
import { tripSources } from '../lib/trip-sources';
import { Price } from './price';

interface Props {
  styles: StyleDates[];
  selected: TripStyle;
  onSelect: (s: TripStyle) => void;
  people: number;
}

// Mockup photo strips (Unsplash placeholders).
const PHOTO: Record<'offbeat' | TripStyle, string> = {
  offbeat: 'photo-1593693397690-362cb9666fc2',
  budget: 'photo-1519046904884-53103b34b206',
  comfort: 'photo-1507525428034-b723cf961d3e',
};
const ICON = { offbeat: ['🌿', '#dcfce7'], budget: ['💰', '#ccfbf1'], comfort: ['🛎️', '#fef3c7'] } as const;

/**
 * Offbeat / Budget / Comfort side by side (brief §2.3). Each card shows that plan's cheapest window.
 * Offbeat comes first, as in the mockup.
 */
export function PlanCards({ styles, selected, onSelect, people }: Props) {
  const t = useTranslations('results');
  const cheapest = styles.reduce<StyleDates | undefined>((a, s) => (s.top[0] && (!a || s.top[0].total < a.top[0]!.total) ? s : a), undefined);

  const strip = (k: keyof typeof PHOTO) => (
    <div
      aria-hidden
      className="-mx-4 -mt-3.5 mb-3 h-[78px] rounded-t-[14px] bg-cover bg-center"
      style={{ backgroundImage: `url('https://images.unsplash.com/${PHOTO[k]}?w=600&q=70')` }}
    />
  );
  const heading = (k: keyof typeof ICON) => (
    <h3 className="flex items-center gap-2 text-base font-bold">
      <span className="grid size-7 place-items-center rounded-lg text-[15px]" style={{ background: ICON[k][1] }} aria-hidden>
        {ICON[k][0]}
      </span>
      {t(`plans.${k}.name`)}
    </h3>
  );

  return (
    <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3" role="radiogroup" aria-label={t('plansLabel')}>
      {styles.map((s) => {
        const w = s.top[0];
        const on = s.style === selected;
        return (
          <button
            key={s.style}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(s.style)}
            className={`relative rounded-2xl border-2 bg-white px-4 py-3.5 text-left transition-shadow hover:shadow-card ${
              on ? 'border-brand ring-4 ring-brand-l' : 'border-line'
            }`}
          >
            {cheapest?.style === s.style && (
              <span className="absolute -top-2.5 right-3.5 z-[2] rounded-full bg-good px-2 py-0.5 text-[11px] font-bold text-white">{t('cheapestTag')}</span>
            )}
            {strip(s.style)}
            {heading(s.style)}
            <p className="mb-2.5 mt-1.5 min-h-[38px] text-[13px] text-muted">
              {w && w.hotel
                ? t('plans.descType', {
                    mode: t(`modes.${w.onward.mode}`),
                    cls: w.onward.travelClass,
                    type: w.hotel.stars > 0 ? `${w.hotel.stars}★` : t(`hotels.type.${w.hotel.type}`),
                  })
                : t(`plans.${s.style}.desc`)}
            </p>
            {w ? (
              <Price
                amount={w.total}
                isEstimate
                size="lg"
                sources={tripSources(w, s.fetchedAt)}
                note={t('forGroup', { people, perPerson: inr(w.perPerson) })}
              />
            ) : (
              <p className="text-sm text-muted">{t('noWindows')}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}
