import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from './locales';

/** Locale comes from the NEXT_LOCALE cookie set by the language switcher (no URL prefix). */
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get('NEXT_LOCALE')?.value;
  const locale = isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
  return { locale, messages: (await import(`../messages/${locale}.json`)).default };
});
