import { buildGuideSection, createRegistry, fixedClock, type GuideSection } from '@tripsaver/providers';
import { describe, expect, test, vi } from 'vitest';
import { getGuide } from '../lib/api';
import { withRestaurants } from '../lib/guide-compat';

const clock = fixedClock('2026-11-08T06:00:00Z');

describe('withRestaurants (guides cached before the restaurants block existed)', () => {
  test('a guide without the block gets the curated sample places, not live', async () => {
    const fresh = await buildGuideSection(createRegistry({}, clock), 'GOA', { clock, timeoutMs: 1000 });
    const { restaurants: _drop, ...old } = fresh;
    void _drop;
    const fixed = withRestaurants(old as unknown as GuideSection);
    expect(fixed.restaurants).toEqual({
      list: fresh.guide!.restaurants,
      live: false,
      realProvider: false,
      source: null,
      fetchedAt: null,
    });
  });

  test('a guide with the block is left as it is', async () => {
    const fresh = await buildGuideSection(createRegistry({}, clock), 'GOA', { clock, timeoutMs: 1000 });
    expect(withRestaurants(fresh)).toBe(fresh);
  });
});

describe('getGuide on guide pages', () => {
  const section = (live: boolean, realProvider: boolean) =>
    ({
      destination: { code: 'GOA' },
      guide: null,
      restaurants: { list: [], live, realProvider, source: null, fetchedAt: null },
    }) as unknown as GuideSection;

  test('a cached copy without the live list (real source on) is fetched again, uncached', async () => {
    const f = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(section(false, true))))
      .mockResolvedValueOnce(new Response(JSON.stringify(section(true, true))));
    const g = await getGuide('GOA');
    expect(g!.restaurants.live).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    expect((f.mock.calls[1]![1] as RequestInit).cache).toBe('no-store');
    f.mockRestore();
  });

  test('a live copy, or sample data with no real source, is used as it is', async () => {
    for (const s of [section(true, true), section(false, false)]) {
      const f = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(s)));
      await getGuide('GOA');
      expect(f).toHaveBeenCalledTimes(1);
      f.mockRestore();
    }
  });
});
