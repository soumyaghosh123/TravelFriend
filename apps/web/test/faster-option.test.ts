import type { DirectionTransport, TransportOffer } from '@tripsaver/providers';
import { describe, expect, test } from 'vitest';
import { fasterOption, MIN_TIME_SAVED_MIN } from '../lib/faster-option';

const offer = (p: Partial<TransportOffer>): TransportOffer =>
  ({
    mode: 'train',
    source: 'mock-rail',
    number: '22897',
    departAt: '2026-12-02T21:30:00',
    travelClass: '3A',
    durationMin: 2060,
    price: { amount: 5560, currency: 'INR' },
    ...p,
  }) as TransportOffer;

const train = offer({});
const flight = offer({
  mode: 'flight',
  source: 'travelpayouts',
  number: '6E 123',
  departAt: '2026-12-02T06:10:00',
  travelClass: 'Economy',
  durationMin: 165,
  price: { amount: 10400, currency: 'INR' },
});
const dir = (fastest?: TransportOffer) => ({ summary: fastest ? { fastest } : {} }) as DirectionTransport;

describe('fasterOption: a quicker way next to the cheapest leg', () => {
  test('suggests the fastest option with the extra cost and time saved', () => {
    expect(fasterOption(train, dir(flight))).toEqual({ offer: flight, extra: 4840, savedMin: 2060 - 165 });
  });

  test('nothing when the chosen leg is already the fastest, or no data yet', () => {
    expect(fasterOption(train, dir(train))).toBeNull();
    expect(fasterOption(train, dir())).toBeNull();
    expect(fasterOption(train, null)).toBeNull();
  });

  test(`nothing when it saves less than ${MIN_TIME_SAVED_MIN / 60} hours`, () => {
    const slightlyFaster = offer({ number: '12345', durationMin: 2060 - MIN_TIME_SAVED_MIN + 1 });
    expect(fasterOption(train, dir(slightlyFaster))).toBeNull();
    const enough = offer({ number: '12345', durationMin: 2060 - MIN_TIME_SAVED_MIN });
    expect(fasterOption(train, dir(enough))).not.toBeNull();
  });

  test('a faster option that is also cheaper shows a negative extra', () => {
    const cheapFlight = { ...flight, price: { amount: 5000, currency: 'INR' as const } };
    expect(fasterOption(train, dir(cheapFlight))?.extra).toBe(-560);
  });
});
