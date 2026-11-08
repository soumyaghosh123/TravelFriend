import { describe, expect, test } from 'vitest';
import { checkedAgo, compactInr, dateRange, dayMonth, inr, monthLabel } from '../lib/format';

describe('format', () => {
  test('INR with Indian digit grouping', () => {
    expect(inr(38400)).toBe('₹38,400');
    expect(inr(3840000)).toBe('₹38,40,000');
  });

  test('compact amounts for calendar cells', () => {
    expect(compactInr(37400)).toBe('37.4k');
    expect(compactInr(60237)).toBe('60.2k');
    expect(compactInr(140000)).toBe('1.4L');
  });

  test('date ranges in one month and across months', () => {
    expect(dateRange('2026-12-05', '2026-12-14', 'en')).toBe('5–14 Dec');
    expect(dateRange('2026-12-28', '2027-01-02', 'en')).toMatch(/^28 Dec 2026\s–\s2 Jan 2027$/); // years shown when the range crosses them (Intl uses thin spaces)
    expect(dayMonth('2026-12-05', 'en')).toBe('5 Dec');
  });

  test('month labels never shift a month (UTC-pinned)', () => {
    expect(monthLabel('2026-12', 'en', 'long')).toBe('December 2026');
    expect(monthLabel('2027-01', 'en')).toBe('Jan 2027');
  });

  test('"checked X ago"', () => {
    const now = Date.parse('2026-11-08T10:06:00Z');
    expect(checkedAgo('2026-11-08T10:00:00Z', now, 'en')).toBe('6 minutes ago');
    expect(checkedAgo('2026-11-08T10:06:00Z', now, 'en')).toBe('this minute');
    expect(checkedAgo('2026-11-08T07:00:00Z', now, 'en')).toBe('3 hours ago');
  });
});
