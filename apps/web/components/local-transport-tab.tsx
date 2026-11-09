'use client';

import type { LocalLegView, LocalSection } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import { hm } from '../lib/transport-match';
import { FareSource } from './fare-source';
import { Price } from './price';

interface Props {
  local: LocalSection;
  plan: string;
  sampleData: boolean;
}

/** Where to book a local option: an app link, a counter or pay on board (brief §3.3). */
function BookingPlace({ booking }: { booking: LocalLegView['options'][number]['booking'] }) {
  const t = useTranslations('results.local');
  return (
    <div className="text-xs text-ink2">
      {booking.url ? (
        <a
          href={booking.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="font-semibold text-brand hover:underline"
        >
          {t('openApp')} ↗
        </a>
      ) : (
        <span className="font-semibold">{t(`booking.${booking.type}`)}</span>
      )}{' '}
      · {booking.where}
      {booking.phone && <> · {booking.phone}</>}
    </div>
  );
}

function LegCard({ leg, plan }: { leg: LocalLegView; plan: string }) {
  const t = useTranslations('results.local');
  const title =
    leg.kind === 'day'
      ? t('dayTitle', { day: leg.dayIndex, base: leg.from })
      : t(`legTitle.${leg.kind}`, { day: leg.dayIndex, from: leg.from, to: leg.to });
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="text-xs text-muted">
            {leg.stops.length > 0 && <>{leg.stops.join(' → ')} · </>}
            {t('km', { km: leg.km })}
          </p>
        </div>
      </header>
      <ul className="mt-2 divide-y divide-dashed divide-line">
        {leg.options.map((o) => {
          const d = hm(o.minutes);
          return (
            <li
              key={o.id}
              className={`flex flex-col gap-2 py-2 sm:flex-row sm:items-start sm:gap-4 ${o.inPlan ? '-mx-2 rounded-lg bg-brand-xl px-2' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <b>{o.name}</b>
                  {o.cheapest && (
                    <span className="rounded-full bg-good-l px-2 py-px text-[11px] font-bold text-good">
                      {t('cheapest')}
                    </span>
                  )}
                  {o.convenient && (
                    <span className="rounded-full bg-brand-l px-2 py-px text-[11px] font-bold text-brand-d">
                      {t('convenient')}
                    </span>
                  )}
                  {o.inPlan && (
                    <span className="rounded-full bg-brand px-2 py-px text-[11px] font-bold text-white">
                      {t('inPlan', { plan })}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {t('time', d)}
                  {o.note && <> · {o.note}</>}
                </div>
                <BookingPlace booking={o.booking} />
                <FareSource source={o.fareSource} />
              </div>
              <div className="sm:w-48 sm:shrink-0 sm:text-right">
                <Price
                  amount={o.min}
                  amountMax={o.max}
                  isEstimate
                  ownEstimate
                  size="md"
                  note={t('forGroup')}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {leg.extras.length > 0 && (
        <div className="mt-2 rounded-[10px] bg-bg px-3 py-2">
          <div className="text-xs font-bold">{t('extrasTitle')}</div>
          <ul className="mt-1 space-y-1.5">
            {leg.extras.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                <div>
                  <b>{e.name}</b>
                  <BookingPlace booking={e.booking} />
                  <FareSource source={e.fareSource} />
                </div>
                <Price
                  amount={e.min}
                  amountMax={e.max}
                  isEstimate
                  ownEstimate
                  size="sm"
                  note={t('returnTrip')}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Tab 5 "Local transport & cabs" (brief §3.3): every journey in the plan, its options, fares and where to book. */
export function LocalTransportTab({ local, plan, sampleData }: Props) {
  const t = useTranslations('results.local');
  return (
    <div className="space-y-3.5">
      {local.tips.length > 0 && (
        <ul className="space-y-1 rounded-card border border-accent/40 bg-accent-l px-4 py-3 text-sm text-[#7c2d12]">
          {local.tips.map((tip) => (
            <li key={tip}>⚠️ {tip}</li>
          ))}
        </ul>
      )}
      {local.legs.length === 0 && (
        <p className="rounded-card bg-white p-4 text-muted shadow-card">{t('noLegs')}</p>
      )}
      {local.legs.map((l) => (
        <LegCard key={l.key} leg={l} plan={plan} />
      ))}
      <section className="flex flex-wrap items-start justify-between gap-3 rounded-card bg-white p-4 shadow-card">
        <div className="max-w-xl text-sm">
          <h2 className="font-bold">{t('totalTitle', { plan })}</h2>
          <p className="text-xs text-muted">{t('totalSub')}</p>
        </div>
        <Price amount={local.total.min} amountMax={local.total.max} isEstimate ownEstimate size="lg" />
      </section>
      <p className="text-xs text-muted">
        {sampleData && <b className="text-warn">{t('sample')} </b>}
        {t('basis')}
      </p>
    </div>
  );
}
