import { expect } from 'vitest';
import type { PricedOffer } from '@tripsaver/domain';

/** Rule 1: every price shows its source, freshness and a booking link. */
export function expectPricedOffer(o: PricedOffer): void {
  expect(o.price.amount).toBeGreaterThanOrEqual(0);
  expect(Number.isInteger(o.price.amount)).toBe(true);
  expect(o.price.currency).toBe('INR');
  expect(o.source).not.toBe('');
  expect(o.sourceName).not.toBe('');
  expect(o.bookingUrl).toMatch(/^https:\/\//);
  expect(o.fetchedAt).not.toBe('');
  expect(typeof o.prefilled).toBe('boolean');
}
