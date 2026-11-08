/** "Dec 2026" in the user's language. Months are `YYYY-MM`; formatting is pinned to UTC so no date shifts. */
export function monthLabel(month: string, locale: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, 1)),
  );
}

/** Indian digit grouping: 3840000 → "₹38,40,000". */
export function inr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
