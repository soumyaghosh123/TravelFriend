'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { authConfig, requestLink } from '../lib/account';

/** Sign in with a one-time email link or with Google (PLAN §12 step 11). No passwords. */
export function SignInForm({ next, failed }: { next: string; failed?: boolean }) {
  const t = useTranslations('account');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'invalid' | 'busy' | 'error'>('idle');
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    authConfig()
      .then((c) => setGoogle(c.google))
      .catch(() => {});
  }, []);

  if (status === 'sent')
    return (
      <div className="rounded-card bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold">{t('checkEmail')}</h2>
        <p className="mt-1 text-ink2">{t('sentTo', { email })}</p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-3 text-sm font-semibold text-brand hover:underline"
        >
          {t('useAnother')}
        </button>
      </div>
    );

  return (
    <div className="rounded-card bg-white p-5 shadow-card">
      <h2 className="text-lg font-bold">{t('signInTitle')}</h2>
      <p className="mt-1 text-sm text-ink2">{t('signInWhy')}</p>
      {failed && <p className="mt-2 rounded-lg bg-bad-l px-3 py-2 text-sm text-bad">{t('googleFailed')}</p>}
      {google && (
        <a
          href={`/api/auth/google?${new URLSearchParams({ next })}`}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 font-semibold hover:border-brand"
        >
          <span aria-hidden className="font-bold text-[#4285f4]">
            G
          </span>
          {t('google')}
        </a>
      )}
      {google && <div className="my-3 text-center text-xs text-muted">{t('or')}</div>}
      <form
        className={google ? '' : 'mt-4'}
        onSubmit={async (e) => {
          e.preventDefault();
          setStatus('sending');
          setStatus(await requestLink(email, next, locale));
        }}
      >
        <label htmlFor="signin-email" className="text-sm font-semibold">
          {t('email')}
        </label>
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={status === 'invalid'}
          aria-describedby={status === 'idle' || status === 'sending' ? undefined : 'signin-error'}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 focus:border-brand focus:outline-none"
        />
        {(status === 'invalid' || status === 'busy' || status === 'error') && (
          <p id="signin-error" className="mt-1 text-sm text-bad">
            {t(`error.${status}`)}
          </p>
        )}
        <button
          type="submit"
          disabled={status === 'sending'}
          className="mt-3 w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-d disabled:opacity-60"
        >
          {status === 'sending' ? t('sending') : t('sendLink')}
        </button>
      </form>
      <p className="mt-3 text-xs text-muted">{t('privacy')}</p>
    </div>
  );
}
