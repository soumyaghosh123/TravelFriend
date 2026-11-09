'use client';

import { groupSights, SIGHT_FILTERS, sightFilters, type SightFilter } from '@tripsaver/domain';
import type { Attraction, GuideSection } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { GuideAnchor } from '../lib/guide-anchor';
import { weekdayShort } from '../lib/format';
import { hm } from '../lib/transport-match';
import { Chip } from './chip';
import { GuideFootnote } from './guide-footnote';
import { Price } from './price';

interface Props {
  guide: GuideSection;
  anchor: GuideAnchor;
  /** Sights the current plan visits. */
  inPlan?: ReadonlySet<string>;
}

const ICON: Record<string, string> = {
  beach: '🏖️',
  fort: '🏰',
  religious: '🛕',
  heritage: '🏛️',
  museum: '🖼️',
  nature: '🌿',
  village: '🏡',
  adventure: '🧗',
  market: '🧺',
  culture: '🎭',
  nightlife: '🌙',
};

type Placed = Attraction & { distanceKm: number; travelMin: number };

function Duration({ min }: { min: number }) {
  const t = useTranslations('results.guide');
  const { h, m } = hm(min);
  return <>{h === 0 ? t('minutes', { m }) : m === 0 ? t('hours', { h }) : t('hoursMinutes', { h, m })}</>;
}

function SightRow({ s, inPlan }: { s: Placed; inPlan: boolean }) {
  const t = useTranslations('results.sights');
  const tg = useTranslations('results.guide');
  const locale = useLocale();
  const allDay = s.open === '00:00' && s.close === '23:59';
  return (
    <li className="flex gap-3 border-b border-dashed border-line py-2.5 last:border-0">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-bg text-lg">
        {ICON[s.category] ?? '📍'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <b>{s.name}</b>
          {inPlan && (
            <span className="rounded-full bg-brand px-2 py-px text-[11px] font-bold text-white">
              {t('inPlan')}
            </span>
          )}
          {s.isOffbeat && (
            <span className="rounded-full bg-good-l px-2 py-px text-[11px] font-bold text-good">
              {t('offbeat')}
            </span>
          )}
          {s.kidFriendly && (
            <span className="rounded-full bg-brand-l px-2 py-px text-[11px] font-bold text-brand-d">
              {t('kidFriendly')}
            </span>
          )}
        </div>
        <p className="text-xs text-ink2">{s.description}</p>
        <p className="text-xs text-muted">
          {allDay ? t('allDay') : t('open', { open: s.open, close: s.close })} ·{' '}
          {s.closedDays.length
            ? t('closed', { days: s.closedDays.map((d) => weekdayShort(d, locale)).join(', ') })
            : t('daily')}{' '}
          · {t('timeNeeded')} <Duration min={s.durationMin} /> · {t(`best.${s.bestTime}`)} ·{' '}
          {tg('distance', { km: Math.round(s.distanceKm) })} (
          <Duration min={s.travelMin} />)
        </p>
        {s.warnings && (
          <p className="text-xs text-warn">
            ⚠️ {[s.warnings.road, s.warnings.network, s.warnings.permit].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <div className="w-32 shrink-0 text-right">
        {s.entryFee === 0 ? (
          <b>{t('free')}</b>
        ) : (
          <Price amount={s.entryFee} isEstimate ownEstimate size="sm" note={t('perAdult')} />
        )}
        <div className="text-[11px] text-muted">{t('rating', { rating: s.rating.toFixed(1) })}</div>
        {s.ticketUrl && (
          <a
            href={s.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-brand hover:underline"
          >
            {t('tickets')} ↗
          </a>
        )}
      </div>
    </li>
  );
}

/** Tab 6 "Sightseeing" (brief §3.4): sights near the hotel and day trips, with filters, hours, fees and distance. */
export function SightsTab({ guide, anchor, inPlan }: Props) {
  const t = useTranslations('results.sights');
  const [filter, setFilter] = useState<SightFilter | 'all'>('all');
  const tagged = useMemo(
    () => guide.sights.map((s) => ({ s, tags: sightFilters(s) })).filter((x) => x.tags.length > 0),
    [guide.sights],
  );
  const available = SIGHT_FILTERS.filter((f) => tagged.some((x) => x.tags.includes(f)));
  const shown = tagged.filter((x) => filter === 'all' || x.tags.includes(filter)).map((x) => x.s);
  const { near, dayTrips } = groupSights(shown, anchor, guide.speedKmh);

  const list = (title: string, items: Placed[]) => (
    <section className="rounded-card bg-white p-4 shadow-card">
      <h3 className="font-bold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t('none')}</p>
      ) : (
        <ul className="mt-1">
          {items.map((s) => (
            <SightRow key={s.id} s={s} inPlan={!!inPlan?.has(s.id)} />
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-3.5">
      <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-1.5">
        {(['all', ...available] as const).map((f) => (
          <Chip key={f} on={filter === f} onToggle={() => setFilter(f)}>
            {t(`filters.${f}`)}
          </Chip>
        ))}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        {list(t('near', { name: anchor.name }), near)}
        {list(t('dayTrips'), dayTrips)}
      </div>
      <GuideFootnote guide={guide} anchor={anchor} />
    </div>
  );
}
