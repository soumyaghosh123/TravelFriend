import { describe, expect, test } from 'vitest';
import { MOCK_ATTRACTIONS } from '../src/mock/data/attractions.js';
import { MOCK_LOCAL_MODES } from '../src/mock/data/local-transport.js';
import { ROUTES } from '../src/mock/data/routes.js';
import { eachDay } from '@tripsaver/domain';
import { hashSeed, mulberry32 } from '../src/mock/rng.js';
import { mockDailyPrice, mockDailyPriceBase } from '../src/mock/pricing-model.js';
import { indiaDate } from '../src/clock.js';
import { MOCK_DESTINATIONS, MOCK_ORIGINS, mockPlaceDirectory } from '../src/mock/data/places.js';
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
    today: '2026-11-08',
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

describe('daily drift (price alerts, spec 2026-11-10)', () => {
  const at = (today: string) => ({
    base: 1000,
    date: '2026-12-05',
    destination: 'GOA',
    key: 'hotel-1',
    events: MOCK_EVENTS.GOA!,
    climate: MOCK_CLIMATE.GOA!,
    today,
  });
  test('indiaDate is the date in India (UTC+05:30)', () => {
    expect(indiaDate(new Date('2026-11-09T18:29:00Z'))).toBe('2026-11-09');
    expect(indiaDate(new Date('2026-11-09T18:31:00Z'))).toBe('2026-11-10');
  });
  test('same day, same price', () => {
    expect(mockDailyPrice(at('2026-11-10'))).toBe(mockDailyPrice(at('2026-11-10')));
  });
  test('the price changes from one day to the next', () => {
    const prices = eachDay('2026-11-01', '2026-11-14').map((d) => mockDailyPrice(at(d)));
    expect(new Set(prices).size).toBeGreaterThanOrEqual(10);
  });
  test('the drift stays within ±4%', () => {
    const base = mockDailyPriceBase(at('2026-11-01'));
    for (const d of eachDay('2026-06-01', '2026-12-17')) {
      const r = mockDailyPrice(at(d)) / base;
      expect(r).toBeGreaterThanOrEqual(0.96 - 0.001);
      expect(r).toBeLessThanOrEqual(1.04 + 0.001);
    }
  });
});

describe('mock places, calendar and climate', () => {
  test('Goa is a region and every destination is reachable by air or rail', () => {
    expect(mockPlaceDirectory.get('GOA')?.kind).toBe('region');
    for (const d of MOCK_DESTINATIONS) {
      expect(d.airports.length + d.stations.length).toBeGreaterThan(0);
    }
    expect(MOCK_DESTINATIONS.map((d) => d.code)).toEqual(
      expect.arrayContaining([
        'DARJEELING',
        'GOA',
        'JAIPUR',
        'KERALA',
        'MANALI',
        'BOM',
        'DEL',
        'AGRA',
        'LEH',
        'ANDAMAN',
      ]),
    );
    expect(MOCK_DESTINATIONS).toHaveLength(25);
    expect(new Set(MOCK_DESTINATIONS.map((d) => d.code)).size).toBe(25);
  });

  test.each(MOCK_DESTINATIONS.map((d) => d.code))(
    '%s: base areas, sights (incl. offbeat and must-see), arrival points, routes and local transport',
    async (code) => {
      const d = mockPlaceDirectory.get(code)!;
      expect(mockPlaceDirectory.isDestination(code)).toBe(true);
      const marks = mockPlaceDirectory.landmarks(code);
      expect(marks.length).toBeGreaterThan(0);
      // Gateways for every way in.
      if (d.stations.length) expect(d.gateways?.train).toBeDefined();
      if (d.airports.length) expect(d.gateways?.flight).toBeDefined();
      const sights = MOCK_ATTRACTIONS[code] ?? [];
      expect(sights.length).toBeGreaterThanOrEqual(6);
      expect(new Set(sights.map((s) => s.id)).size).toBe(sights.length);
      expect(sights.some((s) => s.isHighlight)).toBe(true);
      // The Offbeat plan needs low-footfall spots rated 4+.
      expect(sights.some((s) => s.isOffbeat && s.rating >= 4 && s.footfall === 'low')).toBe(true);
      for (const s of sights) {
        expect(s.open < s.close).toBe(true);
        expect(Math.abs(s.lat - d.lat)).toBeLessThan(3);
        expect(Math.abs(s.lng - d.lng)).toBeLessThan(3);
      }
      // Every starting city can get there and back.
      for (const o of MOCK_ORIGINS.filter((o) => o.code !== code)) {
        expect(ROUTES.some((r) => r.from === o.code && r.to === code)).toBe(true);
        expect(ROUTES.some((r) => r.from === code && r.to === o.code)).toBe(true);
      }
      expect((MOCK_LOCAL_MODES[code] ?? []).length).toBeGreaterThan(2);
      expect((MOCK_EVENTS[code] ?? []).length).toBeGreaterThan(0);
      expect(MOCK_CLIMATE[code]).toHaveLength(12);
    },
  );

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
