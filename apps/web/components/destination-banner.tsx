'use client';

import type { MonthClimate } from '@tripsaver/domain';
import { useLocale, useTranslations } from 'next-intl';
import { destinationLook, photoUrl } from '../lib/destinations';
import { monthShort } from '../lib/format';

interface Props {
  code: string;
  name: string;
  kind: 'city' | 'region';
  month?: string;
  climate?: MonthClimate | null;
  /** Heading; defaults to "Your {name} trip". */
  title?: string;
  /** Link to the destination guide page (results page only). */
  guideHref?: string;
}

/** Destination photo strip with the month's typical weather (mockup `.rbanner`). */
export function DestinationBanner({ code, name, kind, month, climate, title, guideHref }: Props) {
  const t = useTranslations('results');
  const locale = useLocale();
  const look = destinationLook(code);
  const bg = look ? `url('${photoUrl(look.photo, 1800)}') center 60%/cover, ${look.color}` : '#134e4a';
  return (
    <div
      className="relative flex h-[120px] items-end px-3.5 pb-3 text-white md:h-[150px] md:px-6 md:pb-4"
      style={{ background: bg }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-[rgba(4,47,46,.75)] to-[rgba(4,47,46,.1)]"
      />
      <div className="relative mx-auto flex w-full max-w-[1184px] items-end gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-[-.5px] md:text-[26px]">
            {title ?? t('yourTrip', { name })}
          </h1>
          <p className="text-[13px] text-[#e6fffb]">
            {t(`bannerKind.${kind}`)}
            {guideHref && (
              <>
                {' · '}
                <a href={guideHref} className="font-semibold underline hover:text-white">
                  {t('guideLink', { name })}
                </a>
              </>
            )}
          </p>
        </div>
        {climate && month && (
          <div className="ml-auto hidden rounded-xl bg-black/30 px-3 py-1.5 text-right text-[13px] backdrop-blur-sm md:block">
            {t('weather', {
              month: monthShort(Number(month.slice(5, 7)), locale),
              max: climate.maxC,
              min: climate.minC,
            })}
            <br />
            <span className="opacity-80">{climate.summary}</span>
          </div>
        )}
      </div>
    </div>
  );
}
