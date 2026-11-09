'use client';

import { nearestTo, type MonthClimate } from '@tripsaver/domain';
import type { DestinationGuide, GuideSection } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import type { GuideAnchor } from '../lib/guide-anchor';
import { monthShort } from '../lib/format';
import { GuideFootnote } from './guide-footnote';

interface Props {
  guide: GuideSection;
  content: DestinationGuide;
  anchor: GuideAnchor;
  /** The trip month's typical weather, for "What to pack". */
  climate?: MonthClimate | null;
}

/** Tab 9 "Do's & don'ts" (brief §3.8): customs, safety, scams, permits, network, emergency contacts, packing. */
export function DosDontsTab({ guide, content, anchor, climate }: Props) {
  const t = useTranslations('results.dos');
  const locale = useLocale();
  const hospital = nearestTo(content.emergency.hospitals, anchor);
  const police = nearestTo(content.emergency.police, anchor);
  const card = 'rounded-card bg-white p-4 shadow-card';
  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5 md:grid-cols-2">
        <section className={card}>
          <h3 className="font-bold text-good">✅ {t('do')}</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {content.dos.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <h3 className="font-bold text-bad">⛔ {t('dont')}</h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {content.donts.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
        <section className={card}>
          <h3 className="font-bold">🚨 {t('emergency')}</h3>
          <ul className="mt-1.5 space-y-0.5 text-sm">
            {content.emergency.numbers.map((n) => (
              <li key={n.number}>
                {n.label}:{' '}
                <a
                  href={`tel:${n.number.replace(/[^0-9]/g, '')}`}
                  className="font-bold text-brand hover:underline"
                >
                  {n.number}
                </a>
              </li>
            ))}
          </ul>
          <ul className="mt-2 space-y-0.5 text-sm">
            {hospital && (
              <li>{t('nearestHospital', { name: hospital.name, km: Math.round(hospital.distanceKm) })}</li>
            )}
            {police && (
              <li>{t('nearestPolice', { name: police.name, km: Math.round(police.distanceKm) })}</li>
            )}
          </ul>
        </section>
        <section className={card}>
          <h3 className="font-bold">📶 {t('networkTitle')}</h3>
          <dl className="mt-1.5 space-y-1 text-sm">
            <div>
              <dt className="inline font-semibold">{t('network')}: </dt>
              <dd className="inline">{content.network}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t('atms')}: </dt>
              <dd className="inline">{content.atms}</dd>
            </div>
            <div>
              <dt className="inline font-semibold">{t('permits')}: </dt>
              <dd className="inline">{content.permits}</dd>
            </div>
          </dl>
        </section>
        <section className={`${card} md:col-span-2`}>
          <h3 className="font-bold">🎒 {t('packTitle')}</h3>
          {climate && (
            <p className="text-sm text-ink2">
              {t('weather', {
                month: monthShort(climate.month, locale),
                max: climate.maxC,
                min: climate.minC,
              })}{' '}
              · {climate.summary}
            </p>
          )}
          <ul className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
            {content.pack.map((p) => (
              <li key={p} className="rounded-full bg-bg px-3 py-1">
                {p}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <GuideFootnote guide={guide} anchor={anchor} />
    </div>
  );
}
