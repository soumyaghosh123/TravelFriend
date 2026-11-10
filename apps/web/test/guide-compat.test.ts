import { buildGuideSection, createRegistry, fixedClock, type GuideSection } from '@tripsaver/providers';
import { describe, expect, test } from 'vitest';
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
