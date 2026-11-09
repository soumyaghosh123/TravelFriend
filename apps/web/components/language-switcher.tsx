'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { LOCALE_LABELS, LOCALES } from '../i18n/locales';

/** EN · हिं · বাং — stores the choice in the NEXT_LOCALE cookie and re-renders. */
export function LanguageSwitcher() {
  const t = useTranslations('header');
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(l: string) {
    document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t('language')}
      className={`flex rounded-full border border-line bg-white p-0.5 ${pending ? 'opacity-60' : ''}`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() => choose(l)}
          className={`rounded-full px-2.5 py-1 text-[13px] font-medium ${l === locale ? 'bg-brand text-white' : 'text-ink2 hover:text-brand'}`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
