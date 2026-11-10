'use client';

import type { ItinerarySection, PricedWindow, TripStyle } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { dateRange, inr } from '../lib/format';
import { googleCalendarUrl, planIcs, shareUrl, whatsappUrl } from '../lib/trip-export';
import type { SavedTripState } from '../lib/use-saved-trip';
import { PriceAlertButton } from './price-alert-button';
import { SaveTripButton } from './save-trip-button';

interface Props {
  searchId: string;
  style: TripStyle;
  plan: Extract<ItinerarySection, { available: true }>;
  window: PricedWindow;
  /** The plan's total for the group, for the WhatsApp message (null until it is known). */
  total: number | null;
  fromName: string;
  toName: string;
  people: number;
  saved: SavedTripState;
  onSave: (title?: string) => Promise<'signin' | 'ok' | 'error'>;
  /** The saved trip's id, saving it first if needed (for price alerts). */
  ensureSaved: (title?: string) => Promise<string | 'signin' | 'error'>;
}

const btn =
  'inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-[13px] font-semibold text-ink2 hover:border-brand';

/** PDF, share link, WhatsApp and calendar for the plan on screen (PLAN §12 step 10). */
export function TripShareBar({
  searchId,
  style,
  plan,
  window: w,
  total,
  fromName,
  toName,
  people,
  saved,
  onSave,
  ensureSaved,
}: Props) {
  const t = useTranslations('results.export');
  const tp = useTranslations('results.plan');
  const tr = useTranslations('results');
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  // Read after mount so the server render and the first client render match.
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  const link = shareUrl(origin, searchId, style, plan.start);
  const dates = dateRange(plan.start, plan.end, locale);
  const title = t('shareTitle', { from: fromName, to: toName, dates });
  const message =
    total !== null
      ? t('shareText', { title, plan: tr(`plans.${style}.name`), people, total: inr(total), link })
      : `${title} · ${link}`;
  const returnTo = `/trip/${encodeURIComponent(searchId)}?${new URLSearchParams({ plan: style, start: plan.start })}`;
  const printHref = `/trip/${encodeURIComponent(searchId)}/print?${new URLSearchParams({ plan: style, start: plan.start, autoprint: '1' })}`;

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title, text: message, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // The user closed the share sheet.
    }
  };

  const downloadIcs = () => {
    const ics = planIcs(plan, w, searchId, title, { plan: tp, results: tr }, new Date().toISOString());
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `tripsaver-${toName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${plan.start}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div role="group" aria-label={t('label')} className="flex flex-wrap items-center gap-2">
      <SaveTripButton state={saved} save={onSave} title={title} returnTo={returnTo} className={btn} />
      <PriceAlertButton
        saved={saved}
        ensureSaved={ensureSaved}
        total={total}
        title={title}
        returnTo={returnTo}
        className={btn}
      />
      <a href={printHref} target="_blank" rel="noopener" className={btn}>
        📄 {t('pdf')}
      </a>
      <button type="button" onClick={share} className={btn}>
        🔗 {copied ? t('copied') : t('share')}
      </button>
      <a href={whatsappUrl(message)} target="_blank" rel="noopener noreferrer" className={btn}>
        💬 {t('whatsapp')}
      </a>
      <button type="button" onClick={downloadIcs} className={btn}>
        📅 {t('ics')}
      </button>
      <a
        href={googleCalendarUrl({ title, start: plan.start, endInclusive: plan.end, details: link })}
        target="_blank"
        rel="noopener noreferrer"
        className={btn}
      >
        🗓️ {t('google')}
      </a>
    </div>
  );
}
