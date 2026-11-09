'use client';

import { addDays } from '@tripsaver/domain';
import type {
  ItinerarySection,
  PlanCostView,
  PricedWindow,
  TransportOffer,
  TripStyle,
} from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange, weekdayDayMonth } from '../lib/format';
import { COST_PARTS } from './cost-split';
import { PrintDay } from './print-day';
import { Price } from './price';

interface Props {
  plan: Extract<ItinerarySection, { available: true }>;
  window: PricedWindow;
  cost: Extract<PlanCostView, { available: true }>;
  style: TripStyle;
  fromName: string;
  toName: string;
  /** "2 adults · 2 children" */
  travellers: string;
}

/**
 * The plan on paper (PLAN §12 step 10: "Exported PDF matches plan"). It is built from the same plan,
 * window and cost data as the results tabs, so the PDF (browser "Save as PDF") says exactly what they say.
 */
export function TripPrintout({ plan, window: w, cost, style, fromName, toName, travellers }: Props) {
  const t = useTranslations('results.export');
  const tc = useTranslations('results.cost');
  const tr = useTranslations('results');
  const locale = useLocale();
  const ctx = {
    attractions: plan.attractions,
    bases: plan.bases,
    window: w,
    arrivalPoint: plan.arrivalPoint,
    departurePoint: plan.departurePoint,
  };
  const card = 'break-inside-avoid rounded-card border border-line bg-white p-4';

  const leg = (o: TransportOffer, label: string) => (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <b>
          {label}: {tr(`modes.${o.mode}`)} {o.number ?? o.operator} · {o.travelClass}
        </b>
        <div className="text-sm text-ink2">
          {weekdayDayMonth(o.departDate, locale)} {o.departAt.slice(11, 16)} {o.fromPoint} →{' '}
          {weekdayDayMonth(o.arriveDate, locale)} {o.arriveAt.slice(11, 16)} {o.toPoint}
        </div>
        <div className="break-all text-[11px] text-muted">{o.bookingUrl}</div>
      </div>
      <Price amount={o.price.amount} isEstimate={o.isEstimate} offer={o} size="sm" hideBook />
    </div>
  );

  return (
    <article className="mx-auto max-w-[860px] space-y-4 bg-white p-4 text-ink print:p-0">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.08em] text-brand">TripSaver</p>
        <h1 className="text-2xl font-bold tracking-[-.5px]">
          {fromName} → {toName}
        </h1>
        <p className="text-ink2">
          {t('subtitle', {
            plan: tr(`plans.${style}.name`),
            dates: dateRange(plan.start, plan.end, locale),
            days: plan.days.length,
            travellers,
          })}
        </p>
      </header>

      <section className={card}>
        <h2 className="font-bold">{t('costTitle')}</h2>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {COST_PARTS.map((p) => (
              <tr key={p} className="border-t border-line">
                <th scope="row" className="py-1 text-left font-normal">
                  {tc(`rows.${p}`)}
                </th>
                <td className="py-1 text-right">
                  <Price amount={cost.cost[p]} isEstimate={false} size="sm" />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink font-bold">
              <th scope="row" className="py-1.5 text-left">
                {tc('total')}
              </th>
              <td className="py-1.5 text-right">
                <Price
                  amount={cost.cost.total}
                  isEstimate
                  size="md"
                  sources={{ names: cost.sources, fetchedAt: cost.fetchedAt }}
                />
              </td>
            </tr>
            <tr className="text-muted">
              <th scope="row" className="py-1 text-left font-normal">
                {tc('perPerson', { people: cost.cost.people })}
              </th>
              <td className="py-1 text-right">
                <Price amount={cost.cost.perPerson} isEstimate={false} size="sm" />
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={`${card} space-y-3`}>
        <h2 className="font-bold">{t('transportTitle')}</h2>
        {leg(w.onward, t('onward'))}
        {leg(w.return, t('return'))}
      </section>

      <section className={card}>
        <h2 className="font-bold">{t('staysTitle')}</h2>
        <ul className="mt-1 space-y-2 text-sm">
          {plan.bases.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <b>{b.hotel?.name ?? b.name}</b>
                <div className="text-ink2">
                  {b.name} · {t('nights', { n: b.nights })} ·{' '}
                  {dateRange(b.checkIn, addDays(b.checkIn, b.nights), locale)}
                </div>
                {b.hotel && (
                  <div className="break-all text-[11px] text-muted">{b.hotel.cheapest.bookingUrl}</div>
                )}
              </div>
              {b.hotel && b.hotelTotal !== null && (
                <Price
                  amount={b.hotelTotal}
                  isEstimate={b.hotelTotalIsEstimate}
                  offer={b.hotel.cheapest}
                  size="sm"
                  hideBook
                />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="font-bold">{t('daysTitle')}</h2>
        {plan.days.map((d) => (
          <PrintDay key={d.index} day={d} ctx={ctx} />
        ))}
      </section>

      <section className={card}>
        <h2 className="font-bold">{t('checklistTitle')}</h2>
        <ul className="mt-1 space-y-1 text-sm">
          {cost.checklist.map((i) => (
            <li key={i.id} className="flex flex-wrap justify-between gap-2">
              <span>
                ☐{' '}
                {i.kind === 'transport'
                  ? `${i.direction === 'onward' ? t('onward') : t('return')}: ${tr(`modes.${i.offer.mode}`)} ${i.offer.number ?? i.offer.operator}`
                  : i.kind === 'hotel'
                    ? i.hotelName
                    : i.name}
                {(i.kind === 'transport' || i.kind === 'hotel') && (
                  <span className="text-muted"> · {i.offer.sourceName}</span>
                )}
              </span>
              <Price amount={i.amount} isEstimate={i.kind !== 'transport'} size="sm" />
            </li>
          ))}
        </ul>
      </section>

      <footer className="text-xs text-muted">
        {cost.sampleData && <b className="text-warn">{tc('sample')} </b>}
        {tc('disclaimer')}
      </footer>
    </article>
  );
}
