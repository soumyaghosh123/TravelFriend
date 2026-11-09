'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signInHref } from '../lib/account';
import type { SavedTripState } from '../lib/use-saved-trip';

interface Props {
  state: SavedTripState;
  save: (title?: string) => Promise<'signin' | 'ok' | 'error'>;
  title: string;
  /** Where to come back to after signing in (this plan's share link path). */
  returnTo: string;
  className: string;
}

/** "Save trip" to the account; asks you to sign in first, then brings you back to this plan. */
export function SaveTripButton({ state, save, title, returnTo, className }: Props) {
  const t = useTranslations('account');
  if (state.status === 'saved')
    return (
      <Link href="/account" className={`${className} border-good text-good`}>
        ✓ {t('saved')}
      </Link>
    );
  if (state.status === 'anonymous')
    return (
      <Link href={signInHref(returnTo)} className={className}>
        ☆ {t('save')}
      </Link>
    );
  return (
    <button
      type="button"
      disabled={state.status === 'loading' || state.status === 'saving'}
      onClick={async () => {
        if ((await save(title)) === 'signin') window.location.href = signInHref(returnTo);
      }}
      className={`${className} disabled:opacity-50`}
    >
      ☆ {state.status === 'saving' ? t('saving') : state.status === 'error' ? t('saveAgain') : t('save')}
    </button>
  );
}
