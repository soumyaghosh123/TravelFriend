export const LOCALES = ['en', 'hi', 'bn'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', hi: 'हिं', bn: 'বাং' };

export function isLocale(v: string | undefined): v is Locale {
  return (LOCALES as readonly string[]).includes(v ?? '');
}
