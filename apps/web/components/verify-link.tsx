'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { verifyLink } from '../lib/account';

/**
 * The email link lands here, and signing in needs one click on "Continue": email security scanners
 * that open links automatically can't use up the one-time link.
 */
export function VerifyLink({ token, next }: { token: string; next: string }) {
  const t = useTranslations('account');
  const [status, setStatus] = useState<'idle' | 'working' | 'failed'>('idle');
  return (
    <div className="rounded-card bg-white p-5 text-center shadow-card">
      <h1 className="text-lg font-bold">{t('verifyTitle')}</h1>
      {status === 'failed' ? (
        <>
          <p className="mt-2 text-bad">{t('linkExpired')}</p>
          <Link
            href={`/account?${new URLSearchParams({ next })}`}
            className="mt-3 inline-block font-semibold text-brand hover:underline"
          >
            {t('newLink')}
          </Link>
        </>
      ) : (
        <button
          type="button"
          disabled={status === 'working' || !token}
          onClick={async () => {
            setStatus('working');
            if (await verifyLink(token).catch(() => false)) window.location.replace(next);
            else setStatus('failed');
          }}
          className="mt-4 rounded-xl bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-d disabled:opacity-60"
        >
          {status === 'working' ? t('signingIn') : t('continue')}
        </button>
      )}
    </div>
  );
}
