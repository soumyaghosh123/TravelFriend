import { describe, expect, test } from 'vitest';
import { decideAlert, suggestAlertThreshold } from '../src/alerts/alerts.js';

const base = { threshold: 40000, lastNotifiedAmount: null, startDate: '2026-12-06', today: '2026-11-10' };

describe('decideAlert (spec 2026-11-10-price-alerts)', () => {
  test('below the threshold, never emailed → notify', () => {
    expect(decideAlert({ ...base, currentTotal: 38400 })).toBe('notify');
  });
  test('equal to or above the threshold → skip', () => {
    expect(decideAlert({ ...base, currentTotal: 40000 })).toBe('skip');
    expect(decideAlert({ ...base, currentTotal: 41000 })).toBe('skip');
  });
  test('same total as the last email → skip (no daily repeat)', () => {
    expect(decideAlert({ ...base, lastNotifiedAmount: 38400, currentTotal: 38400 })).toBe('skip');
  });
  test('a further drop below the last email → notify again', () => {
    expect(decideAlert({ ...base, lastNotifiedAmount: 38400, currentTotal: 37000 })).toBe('notify');
  });
  test('back up a little but still under the threshold → skip', () => {
    expect(decideAlert({ ...base, lastNotifiedAmount: 38400, currentTotal: 39000 })).toBe('skip');
  });
  test('start date passed → expire, even when below the threshold', () => {
    expect(decideAlert({ ...base, startDate: '2026-11-09', currentTotal: 30000 })).toBe('expire');
  });
  test('starting today is not expired', () => {
    expect(decideAlert({ ...base, startDate: '2026-11-10', currentTotal: 38400 })).toBe('notify');
  });
});

describe('suggestAlertThreshold', () => {
  test('5% below the total, rounded down to ₹100', () => {
    expect(suggestAlertThreshold(38400)).toBe(36400);
    expect(suggestAlertThreshold(150)).toBe(100);
    expect(suggestAlertThreshold(90)).toBe(0);
  });
});
