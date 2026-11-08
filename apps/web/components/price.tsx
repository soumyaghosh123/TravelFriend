'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { checkedAgo, inr } from '../lib/format';

/** A bookable price from one site. */
export interface PriceOffer {
  sourceName: string;
  fetchedAt: string;
  bookingUrl: string;
  prefilled: boolean;
}

/** A total built from several sites' prices (e.g. a whole trip). */
export interface PriceSources {
  names: string[];
  fetchedAt: string;
}

interface Props {
  amount: number;
  /** Shows the amber "approx." badge (golden rule 1). */
  isEstimate: boolean;
  offer?: PriceOffer;
  sources?: PriceSources;
  /** For estimates we make ourselves (no external site), e.g. local spend. */
  ownEstimate?: boolean;
  /** e.g. "for 4 travellers · ≈ ₹15,060 / person" */
  note?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the booking button (e.g. when the row already has one). */
  hideBook?: boolean;
  /**
   * Compact pill for price comparisons: "Agoda ₹11,550" as the booking link itself, with source,
   * freshness and estimate status in its accessible label and tooltip. Needs `offer`.
   */
  chip?: { highlight?: boolean };
}

const SIZE = { sm: 'text-sm', md: 'text-base', lg: 'text-2xl tracking-[-.5px]' } as const;

/** Re-renders every minute so "checked X min ago" stays true. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * The only way prices are rendered: amount, "approx." when estimated, where it comes from,
 * how fresh it is, and a booking link with dates and travellers filled in (CLAUDE.md rule 1).
 */
export function Price({ amount, isEstimate, offer, sources, ownEstimate, note, size = 'md', hideBook, chip }: Props) {
  const t = useTranslations('price');
  const locale = useLocale();
  const now = useNow();
  const fetchedAt = offer?.fetchedAt ?? sources?.fetchedAt;

  if (chip && offer) {
    const label = [
      t('book', { site: offer.sourceName }),
      inr(amount),
      isEstimate ? t('approx') : null,
      t('checked', { ago: checkedAgo(offer.fetchedAt, now, locale) }),
      chip.highlight ? t('cheapestSite') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <a
        href={offer.bookingUrl}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={label}
        title={label}
        className={`block rounded-lg border px-2 py-1 text-[11px] ${
          chip.highlight ? 'border-good bg-good-l font-semibold text-good' : 'border-line text-ink2 hover:border-brand'
        }`}
      >
        {offer.sourceName} <b className="tabular-nums">{inr(amount)}</b>
        {isEstimate && <span className="ml-0.5 text-warn">*</span>}
      </a>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-x-1.5">
        <span className={`font-extrabold tabular-nums ${SIZE[size]}`}>{inr(amount)}</span>
        {isEstimate && (
          <span className="rounded bg-warn-l px-1.5 py-px text-[10px] font-bold uppercase text-warn" title={t('approxHint')}>
            {t('approx')}
          </span>
        )}
      </div>
      {note && <div className="text-xs text-muted">{note}</div>}
      <div className="text-[11px] text-muted">
        {offer && t.rich('cheapestOn', { site: offer.sourceName, b: (c) => <b className="text-ink2">{c}</b> })}
        {sources && t('builtFrom', { sites: sources.names.join(', ') })}
        {ownEstimate && t('ownEstimate')}
        {fetchedAt && <> · {t('checked', { ago: checkedAgo(fetchedAt, now, locale) })}</>}
      </div>
      {offer && !hideBook && (
        <div className="mt-1.5">
          <a
            href={offer.bookingUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-block rounded-lg bg-brand px-2.5 py-1.5 text-[13px] font-semibold text-white hover:bg-brand-d"
          >
            {t('book', { site: offer.sourceName })} ↗
          </a>
          {!offer.prefilled && <div className="mt-0.5 text-[11px] text-muted">{t('notPrefilled')}</div>}
        </div>
      )}
    </div>
  );
}
