function intlLocale(locale: string): string {
  return locale === 'en' ? 'en-IN' : `${locale}-IN`;
}

function utcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

/** "Dec 2026" in the user's language. Months are `YYYY-MM`; formatting is pinned to UTC so no date shifts. */
export function monthLabel(month: string, locale: string, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: style,
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utcDate(month));
}

/** "Dec" / "दिस॰" — month name only, for chart axes. */
export function monthShort(month: number, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, month - 1, 1)),
  );
}

/** "5 Dec" in the user's language. */
export function dayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(utcDate(iso));
}

/** "5–14 Dec", "28 Dec – 2 Jan" in the user's language. */
export function dateRange(start: string, end: string, locale: string): string {
  const f = new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return f.formatRange(utcDate(start), utcDate(end));
}

/** Indian digit grouping: 3840000 → "₹38,40,000". */
export function inr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/** Compact amount for calendar cells: 37400 → "37.4k", 140000 → "1.4L". */
export function compactInr(amount: number): string {
  if (amount >= 100_000) return `${(amount / 100_000).toFixed(amount >= 1_000_000 ? 0 : 1)}L`;
  return `${(amount / 1000).toFixed(1)}k`;
}

/** "6 min ago" / "just now" in the user's language. */
export function checkedAgo(fetchedAt: string, now: number, locale: string): string {
  const mins = Math.max(0, Math.round((now - Date.parse(fetchedAt)) / 60_000));
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  return hours < 24 ? rtf.format(-hours, 'hour') : rtf.format(-Math.round(hours / 24), 'day');
}

/** "Fri" / "शुक्र" for a day of the week (0 = Sunday). 8 Nov 2026 is a Sunday. */
export function weekdayShort(day: number, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(2026, 10, 8 + day)),
  );
}

/** "Fri 4 Dec" in the user's language. */
export function weekdayDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(utcDate(iso));
}
