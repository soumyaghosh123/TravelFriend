'use client';

import { isWeeklyMarket, marketDaysInTrip, splitShops } from '@tripsaver/domain';
import type { DestinationGuide, GuideSection, Shop } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import type { GuideAnchor } from '../lib/guide-anchor';
import { weekdayDayMonth, weekdayShort } from '../lib/format';
import { GuideFootnote } from './guide-footnote';
import { Price } from './price';

interface Props {
  guide: GuideSection;
  content: DestinationGuide;
  anchor: GuideAnchor;
  /** Trip dates, to show which weekly markets fall on them (none on guide pages). */
  trip?: { start: string; end: string };
}

const ICON: Record<Shop['kind'], string> = {
  market: '🧺',
  emporium: '🏛️',
  cooperative: '🤝',
  'gi-outlet': '🏷️',
  shop: '🛍️',
};

function ShopRow({ s, trip }: { s: Shop & { distanceKm: number }; trip?: Props['trip'] }) {
  const t = useTranslations('results.shop');
  const tg = useTranslations('results.guide');
  const locale = useLocale();
  const weekly = isWeeklyMarket(s.openDays);
  const onTrip = trip && weekly ? marketDaysInTrip(s.openDays, trip.start, trip.end) : null;
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((d) => !s.openDays.includes(d));
  const days = weekly
    ? s.openDays.map((d) => weekdayShort(d, locale)).join(', ')
    : closed.length === 0
      ? t('everyDay')
      : t('closedOn', { days: closed.map((d) => weekdayShort(d, locale)).join(', ') });
  return (
    <li className="flex gap-3 border-b border-dashed border-line py-2.5 last:border-0">
      <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-bg text-lg">
        {ICON[s.kind]}
      </span>
      <div className="min-w-0 flex-1">
        <b>{s.name}</b>
        <p className="text-xs text-muted">
          {days} · {s.hours} · {tg('distance', { km: Math.round(s.distanceKm) })}
        </p>
        {onTrip && (
          <p className={`text-xs font-semibold ${onTrip.length ? 'text-good' : 'text-muted'}`}>
            {onTrip.length
              ? t('onTrip', { dates: onTrip.map((d) => weekdayDayMonth(d, locale)).join(', ') })
              : t('notOnTrip')}
          </p>
        )}
        <ul className="mt-1 space-y-1 text-xs">
          {s.buy.map((b) => (
            <li key={b.item} className="flex flex-wrap items-baseline justify-between gap-2">
              <span>• {b.item}</span>
              {b.priceMin !== undefined && (
                <Price
                  amount={b.priceMin}
                  amountMax={b.priceMax}
                  isEstimate
                  ownEstimate
                  size="sm"
                  note={b.unit ? t('perUnit', { unit: b.unit }) : undefined}
                />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span
            className={`rounded px-1.5 py-px text-[11px] font-bold ${s.bargain === 'fixed' ? 'bg-good-l text-good' : 'bg-warn-l text-warn'}`}
          >
            {s.bargain === 'hard' && s.bargainStartPct
              ? t('bargain.hard', { min: s.bargainStartPct[0], max: s.bargainStartPct[1] })
              : t(`bargain.${s.bargain === 'hard' ? 'some' : s.bargain}`)}
          </span>
          {s.tags.map((tag) => (
            <span key={tag} className="rounded bg-bg px-1.5 py-px text-[11px] font-semibold text-ink2">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </li>
  );
}

/** Tab 8 "Shopping" (brief §3.7): markets (and which fall on your dates), fair-price shops, what to buy, traps. */
export function ShoppingTab({ guide, content, anchor, trip }: Props) {
  const t = useTranslations('results.shop');
  const { markets, fairPrice, others } = splitShops(content.shops, anchor);
  const card = (title: string, items: typeof markets) =>
    items.length > 0 && (
      <section className="rounded-card bg-white p-4 shadow-card">
        <h3 className="font-bold">{title}</h3>
        <ul className="mt-1">
          {items.map((s) => (
            <ShopRow key={s.id} s={s} trip={trip} />
          ))}
        </ul>
      </section>
    );
  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5 lg:grid-cols-2">
        {card(t('marketsTitle'), markets)}
        <div className="space-y-3.5">
          {card(t('fairTitle'), fairPrice)}
          {card(t('othersTitle'), others)}
          {content.traps.length > 0 && (
            <ul className="space-y-1 rounded-card border border-accent/40 bg-accent-l px-4 py-3 text-sm text-[#7c2d12]">
              {content.traps.map((trap) => (
                <li key={trap}>
                  ⚠️ <b>{t('trap')}</b> {trap}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <GuideFootnote guide={guide} anchor={anchor} />
    </div>
  );
}
