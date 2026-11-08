import type { PricedWindow, TransportOffer, TransportSection } from '@tripsaver/providers';
import { describe, expect, test } from 'vitest';
import { slowModeTip } from '../lib/slow-mode';

const offer = (p: Partial<TransportOffer>): TransportOffer =>
  ({ mode: 'train', price: { amount: 3000, currency: 'INR' }, departDate: '2026-12-01', arriveDate: '2026-12-02', ...p }) as TransportOffer;

const w = {
  start: '2026-12-01',
  end: '2026-12-10',
  onward: offer({ departDate: '2026-12-01', arriveDate: '2026-12-02', price: { amount: 6625, currency: 'INR' } }),
  return: offer({ departDate: '2026-12-09', arriveDate: '2026-12-10', price: { amount: 6625, currency: 'INR' } }),
} as PricedWindow;

const transport = (fastest: TransportOffer, back: TransportOffer) =>
  ({ onward: { summary: { fastest } }, return: { summary: { fastest: back } } }) as unknown as TransportSection;

const flightOut = offer({ mode: 'flight', departDate: '2026-12-01', arriveDate: '2026-12-01', price: { amount: 19800, currency: 'INR' } });
const flightBack = offer({ mode: 'flight', departDate: '2026-12-09', arriveDate: '2026-12-09', price: { amount: 19800, currency: 'INR' } });

describe('slowModeTip (PLAN A1)', () => {
  test('2 of 10 days travelling is not over 20%; 3 of 10 is → fly for the difference, about 2 more days', () => {
    expect(slowModeTip(w, 10, 2, transport(flightOut, flightBack))).toBeNull();
    expect(slowModeTip(w, 10, 3, transport(flightOut, flightBack))).toMatchObject({ extra: 39600 - 13250, daysGained: 2 });
  });
  test('no tip without a flight, or without transport data', () => {
    expect(slowModeTip(w, 10, 4, transport(offer({}), flightBack))).toBeNull();
    expect(slowModeTip(w, 10, 4, null)).toBeNull();
  });
});
