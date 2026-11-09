'use client';

import { addDays } from '@tripsaver/domain';
import type { ChecklistItem } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange, weekdayDayMonth } from '../lib/format';
import { useBooked } from '../lib/use-booked';
import { Price } from './price';

interface Props {
  searchId: string;
  style: string;
  start: string;
  items: ChecklistItem[];
  /** e.g. "2 adults + 2 children" */
  travellers: string;
}

function Row({ item, travellers }: { item: ChecklistItem; travellers: string }) {
  const t = useTranslations('results.cost.check');
  const locale = useLocale();
  switch (item.kind) {
    case 'transport': {
      const o = item.offer;
      return (
        <>
          <div className="min-w-0 flex-1">
            <b>
              {t(`transport.${item.direction}`, {
                mode: t(`mode.${o.mode}`),
                name: [o.number, o.travelClass].filter(Boolean).join(' · ') || o.operator,
              })}
            </b>
            <div className="text-xs text-muted">
              {weekdayDayMonth(o.departDate, locale)} · {o.departAt.slice(-5)} · {o.fromPoint} → {o.toPoint} ·{' '}
              {travellers}
            </div>
          </div>
          <div className="w-40 shrink-0 text-right">
            <Price amount={item.amount} isEstimate={o.isEstimate} offer={o} size="sm" />
          </div>
        </>
      );
    }
    case 'hotel':
      return (
        <>
          <div className="min-w-0 flex-1">
            <b>{t('hotel', { name: item.hotelName })}</b>
            <div className="text-xs text-muted">
              {item.baseName} · {dateRange(item.checkIn, addDays(item.checkIn, item.nights), locale)} ·{' '}
              {t('nights', { n: item.nights })} · {t('rooms', { n: item.rooms })}
            </div>
          </div>
          <div className="w-40 shrink-0 text-right">
            <Price
              amount={item.amount}
              isEstimate={item.isEstimate || item.offer.isEstimate}
              offer={item.offer}
              size="sm"
            />
          </div>
        </>
      );
    case 'ticket':
      return (
        <>
          <div className="min-w-0 flex-1">
            <b>{t('ticket', { name: item.name })}</b>
            <div className="text-xs text-muted">
              {weekdayDayMonth(item.date, locale)} · {travellers}
            </div>
            {item.ticketUrl ? (
              <a
                href={item.ticketUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-brand hover:underline"
              >
                {t('officialTickets')} ↗
              </a>
            ) : (
              <div className="text-xs text-ink2">{t('payAtGate')}</div>
            )}
          </div>
          <div className="w-40 shrink-0 text-right">
            <Price amount={item.amount} isEstimate ownEstimate size="sm" />
          </div>
        </>
      );
    case 'local-extra':
      return (
        <>
          <div className="min-w-0 flex-1">
            <b>{item.name}</b>
            <div className="text-xs text-muted">
              {weekdayDayMonth(item.date, locale)} · {item.booking.where}
            </div>
          </div>
          <div className="w-40 shrink-0 text-right">
            <Price amount={item.amount} isEstimate ownEstimate size="sm" />
          </div>
        </>
      );
  }
}

/** "Book everything" (PLAN §6.7): each item → cheapest site → group price → link, with a "booked" tick that persists. */
export function BookingChecklist({ searchId, style, start, items, travellers }: Props) {
  const t = useTranslations('results.cost.check');
  const { booked, toggle } = useBooked(searchId, style, start);
  const done = items.filter((i) => booked.has(i.id)).length;
  return (
    <div>
      <p className="text-xs text-muted" aria-live="polite">
        {t('progress', { done, total: items.length })}
      </p>
      <div className="mb-2 mt-1 h-1.5 overflow-hidden rounded-full bg-bg">
        <i
          className="block h-full bg-good transition-[width]"
          style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
        />
      </div>
      <ul className="divide-y divide-dashed divide-line">
        {items.map((i) => {
          const on = booked.has(i.id);
          return (
            <li key={i.id} className={`flex items-start gap-3 py-2.5 ${on ? 'opacity-60' : ''}`}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(i.id)}
                aria-label={t('markBooked')}
                className="mt-1 size-4 shrink-0 accent-[#16a34a]"
              />
              <div className={`flex min-w-0 flex-1 flex-wrap gap-2 ${on ? '[&_b]:line-through' : ''}`}>
                <Row item={i} travellers={travellers} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
