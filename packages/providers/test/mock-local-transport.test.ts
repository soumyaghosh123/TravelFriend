import { describe, expect, test } from 'vitest';
import { localFare } from '@tripsaver/domain';
import { MockLocalTransportProvider } from '../src/mock/local-transport.js';
import { MOCK_ATTRACTIONS } from '../src/mock/data/attractions.js';
import { MOCK_DESTINATIONS } from '../src/mock/data/places.js';

const local = new MockLocalTransportProvider();
const family = { adults: 2, childAges: [3, 6] };
const destinations = MOCK_DESTINATIONS.map((d) => d.code);

describe('MockLocalTransportProvider contract', () => {
  test.each(destinations)('%s: modes with ids, names, where to book and sane numbers', async (dest) => {
    const modes = await local.modes(dest);
    expect(modes.length).toBeGreaterThan(0);
    expect(new Set(modes.map((m) => m.id)).size).toBe(modes.length);
    for (const m of modes) {
      expect(m.name).toBeTruthy();
      expect(m.booking.where).toBeTruthy();
      if (m.booking.type === 'app') expect(m.booking.url).toMatch(/^https:\/\//);
      expect(m.capacity).toBeGreaterThanOrEqual(1);
      expect(m.speedKmh).toBeGreaterThan(0);
      expect(m.spread).toBeGreaterThanOrEqual(0);
      expect(m.spread).toBeLessThan(1);
    }
  });

  test.each(destinations)(
    '%s: every kind of journey has at least one option, and there are tips',
    async (dest) => {
      const modes = (await local.modes(dest)).filter((m) => !m.forAttraction);
      for (const kind of ['arrival', 'departure', 'move', 'day'] as const)
        expect(modes.some((m) => localFare(m, [8], family, kind) !== null)).toBe(true);
      expect((await local.tips(dest)).length).toBeGreaterThan(0);
    },
  );

  test.each(destinations)('%s: sight-specific trips point at a real sight', async (dest) => {
    const ids = new Set((MOCK_ATTRACTIONS[dest] ?? []).map((a) => a.id));
    for (const m of await local.modes(dest)) if (m.forAttraction) expect(ids.has(m.forAttraction)).toBe(true);
  });

  test.each(destinations)(
    '%s: every fare says where it comes from; sourced fares have a link and a date',
    async (dest) => {
      for (const m of await local.modes(dest)) {
        expect(['official', 'reported', 'sample']).toContain(m.fareSource.basis);
        if (m.fareSource.basis !== 'sample') {
          expect(m.fareSource.name).toBeTruthy();
          expect(m.fareSource.url).toMatch(/^https:\/\//);
          expect(m.fareSource.asOf).toMatch(/^\d{4}-\d{2}$/);
        }
      }
    },
  );

  test('sourced fares match their notification: HRTC hills ₹2.50/km with a ₹10 minimum; Water Metro ₹20–40', async () => {
    const one = { adults: 1, childAges: [] };
    const hrtc = (await local.modes('MANALI')).find((m) => m.id === 'hrtc')!;
    expect(localFare(hrtc, [2], one, 'day')).toEqual({ min: 10, max: 10 });
    expect(localFare(hrtc, [10], one, 'day')).toEqual({ min: 25, max: 25 });
    const wm = (await local.modes('KERALA')).find((m) => m.id === 'water-metro')!;
    // Every fare within the published ₹20–40 band, for any leg the Water Metro serves (≤ 10 km).
    for (const km of [0.5, 3, 6, 10]) {
      const f = localFare(wm, [km], one, 'day')!;
      expect(f.min).toBeGreaterThanOrEqual(20);
      expect(f.max).toBeLessThanOrEqual(40);
    }
    expect(localFare(wm, [10], one, 'day')!.max).toBe(40);
  });

  test('unknown destination → no modes, no tips', async () => {
    expect(await local.modes('NOWHERE')).toEqual([]);
    expect(await local.tips('NOWHERE')).toEqual([]);
  });
});
