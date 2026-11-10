'use client';

import { suggestAlertThreshold } from '@tripsaver/domain';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { setAlert, signInHref } from '../lib/account';
import { inr } from '../lib/format';
import type { SavedTripState } from '../lib/use-saved-trip';

interface Props {
  saved: SavedTripState;
  /** The saved trip's id, saving it first if needed. */
  ensureSaved: (title?: string) => Promise<string | 'signin' | 'error'>;
  /** Today's group total for the plan on screen (null until known). */
  total: number | null;
  title?: string;
  /** Where to come back to after signing in. */
  returnTo: string;
  className: string;
  /** Tests: render with the form open. */
  initiallyOpen?: boolean;
}

/** "Tell me when this trip drops below ₹X" (spec 2026-11-10-price-alerts). Saves the trip first if needed. */
export function PriceAlertButton({
  saved,
  ensureSaved,
  total,
  title,
  returnTo,
  className,
  initiallyOpen = false,
}: Props) {
  const t = useTranslations('alerts');
  const locale = useLocale();
  const [open, setOpen] = useState(initiallyOpen);
  const [amount, setAmount] = useState(total !== null ? String(suggestAlertThreshold(total)) : '');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<'threshold' | 'unavailable' | 'failed' | null>(null);

  if (saved.status === 'anonymous')
    return (
      <Link href={signInHref(returnTo)} className={className}>
        🔔 {t('signIn')}
      </Link>
    );

  const submit = async () => {
    const threshold = Number(amount);
    if (!Number.isInteger(threshold) || threshold <= 0 || (total !== null && threshold >= total))
      return setError('threshold');
    setBusy(true);
    setError(null);
    try {
      const tripId = await ensureSaved(title);
      if (tripId === 'signin') return void (window.location.href = signInHref(returnTo));
      if (tripId === 'error') return setError('failed');
      const r = await setAlert(tripId, threshold, locale);
      if (r === 'signin') return void (window.location.href = signInHref(returnTo));
      if ('error' in r) return setError(r.error);
      setDone(r.threshold);
    } catch {
      setError('failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        disabled={total === null}
        onClick={() => {
          setOpen((o) => !o);
          if (!amount && total !== null) setAmount(String(suggestAlertThreshold(total)));
        }}
        className={`${className} disabled:opacity-50`}
      >
        🔔 {t('button')}
      </button>
      {open && total !== null && (
        <div className="absolute left-0 z-20 mt-2 w-72 rounded-card border border-line bg-white p-3.5 shadow-card">
          {done !== null ? (
            <p className="text-sm text-good">{t('saved', { threshold: inr(done) })}</p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              className="space-y-2"
            >
              <label htmlFor="alert-amount" className="block text-sm font-semibold">
                {t('title')}
              </label>
              <div className="flex items-center rounded-lg border border-line px-2.5 focus-within:border-brand">
                <span className="text-ink2">₹</span>
                <input
                  id="alert-amount"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-transparent px-1.5 py-2 outline-none"
                />
              </div>
              <p className="text-xs text-muted">{t('today', { total: inr(total) })}</p>
              {error && <p className="text-xs font-semibold text-bad">{t(`errors.${error}`)}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-2 text-sm text-ink2">
                  {t('close')}
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-d disabled:opacity-50"
                >
                  {t('set')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
