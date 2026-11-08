import { describe, expect, test } from 'vitest';
import { eachDay } from '@tripsaver/domain';
import { hashSeed, mulberry32 } from '../src/mock/rng.js';
import { mockDailyPrice } from '../src/mock/pricing-model.js';
import { MOCK_DESTINATIONS, mockPlaceDirectory } from '../src/mock/data/places.js';
import { MOCK_CLIMATE, MOCK_EVENTS } from '../src/mock/data/calendar.js';
import { MockCalendarEventsProvider, MockWeatherProvider } from '../src/mock/calendar.js';

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('mulberry32', () => {
  test('is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
  });

  test('hashSeed differs for different keys', () => {
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('mockDailyPrice', () => {
  const args = (date: string) => ({
    base: 1000,
    date,
    destination: 'GOA',
    key: 'hotel-1',
    events: MOCK_EVENTS.GOA!,
    climate: MOCK_CLIMATE.GOA!,
  });

  test('is deterministic', () => {
    expect(mockDailyPrice(args('2026-12-05'))).toBe(mockDailyPrice(args('2026-12-05')));
  });

  test('Goa late December is far dearer than early December', () => {
    const early = mean(eachDay('2026-12-01', '2026-12-10').map((d) => mockDailyPrice(args(d))));
    const late = mean(eachDay('2026-12-21', '2026-12-30').map((d) => mockDailyPrice(args(d))));
    expect(late).toBeGreaterThan(1.5 * early);
  });
});

describe('mock places, calendar and climate', () => {
  test('Goa is a region and every destination is reachable by air or rail', () => {
    expect(mockPlaceDirectory.get('GOA')?.kind).toBe('region');
    for (const d of MOCK_DESTINATIONS) {
      expect(d.airports.length + d.stations.length).toBeGreaterThan(0);
    }
    expect(MOCK_DESTINATIONS.map((d) => d.code).sort()).toEqual(['DARJEELING', 'GOA', 'JAIPUR', 'KERALA', 'MANALI']);
  });

  test('every destination has 12 months of climate and ≥ 2 events from Dec 2026 to Mar 2027', () => {
    for (const d of MOCK_DESTINATIONS) {
      expect(MOCK_CLIMATE[d.code]).toHaveLength(12);
      const winter = MOCK_EVENTS[d.code]!.filter((e) => e.end >= '2026-12-01' && e.start <= '2027-03-31');
      expect(winter.length).toBeGreaterThanOrEqual(2);
    }
  });

  test('providers return Goa December events and climate', async () => {
    const events = await new MockCalendarEventsProvider().events('GOA', 2026, 12);
    expect(events.some((e) => /Christmas/.test(e.name))).toBe(true);
    expect(events.every((e) => e.end >= '2026-12-01' && e.start <= '2026-12-31')).toBe(true);
    expect(await new MockWeatherProvider().climate('GOA')).toHaveLength(12);
  });
});
