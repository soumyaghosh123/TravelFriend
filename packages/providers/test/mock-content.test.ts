import { describe, expect, test } from 'vitest';
import { fixedClock } from '../src/clock.js';
import { buildGuideSection } from '../src/guide-section.js';
import type { ContentProvider } from '../src/interfaces.js';
import { MockContentProvider } from '../src/mock/content.js';
import { MOCK_DESTINATIONS } from '../src/mock/data/places.js';
import { createRegistry } from '../src/registry.js';

const content = new MockContentProvider();
const destinations = MOCK_DESTINATIONS.map((d) => d.code);
const clock = fixedClock('2026-11-08T10:00:00Z');

describe('MockContentProvider contract (brief §3.6–3.8)', () => {
  test.each(destinations)('%s: dishes, restaurants, shops and do’s & don’ts are complete', async (dest) => {
    const g = (await content.guide(dest))!;
    expect(g.destination).toBe(dest);
    expect(g.lastVerifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    expect(g.dishes.length).toBeGreaterThanOrEqual(5);
    expect(g.dishes.some((d) => d.vegType === 'veg')).toBe(true);
    for (const d of g.dishes) expect(d.priceMax).toBeGreaterThanOrEqual(d.priceMin);

    expect(g.restaurants.length).toBeGreaterThanOrEqual(7);
    const dishIds = new Set(g.dishes.map((d) => d.id));
    for (const r of g.restaurants) {
      // Restaurants are generic samples, never invented ratings for a real business.
      expect(r.name).toMatch(/\(sample\)$/);
      expect(r.dishes.length).toBeGreaterThan(0);
      for (const d of r.dishes) expect(dishIds.has(d)).toBe(true);
    }
    expect(g.restaurants.some((r) => r.vegType === 'veg')).toBe(true);
    // Every plan style finds its kind of place.
    for (const kind of ['street', 'homely', 'budget', 'restaurant'] as const)
      expect(g.restaurants.some((r) => r.kind === kind)).toBe(true);
    // Every dish can be found somewhere.
    for (const d of g.dishes) expect(g.restaurants.some((r) => r.dishes.includes(d.id))).toBe(true);

    expect(g.shops.length).toBeGreaterThanOrEqual(5);
    expect(g.shops.some((s) => s.kind === 'market')).toBe(true);
    expect(g.shops.some((s) => ['emporium', 'cooperative', 'gi-outlet'].includes(s.kind))).toBe(true);
    for (const s of g.shops) {
      expect(s.buy.length).toBeGreaterThan(0);
      expect(s.openDays.every((d) => d >= 0 && d <= 6)).toBe(true);
      if (s.bargain === 'hard') expect(s.bargainStartPct).toBeDefined();
    }
    expect(g.traps.length).toBeGreaterThan(0);

    expect(g.dos.length).toBeGreaterThanOrEqual(4);
    expect(g.donts.length).toBeGreaterThanOrEqual(4);
    expect(g.emergency.numbers.map((n) => n.number)).toContain('112');
    expect(g.emergency.hospitals.length).toBeGreaterThan(0);
    expect(g.emergency.police.length).toBeGreaterThan(0);
    for (const s of [g.network, g.atms, g.permits]) expect(s).toBeTruthy();
    expect(g.pack.length).toBeGreaterThan(0);
  });

  test('unknown destination → null', async () => {
    expect(await content.guide('NOWHERE')).toBeNull();
  });
});

describe('buildGuideSection', () => {
  test('Goa: all sights, the guide, main area and road speed', async () => {
    const s = await buildGuideSection(createRegistry({}, clock), 'GOA', { clock, timeoutMs: 1000 });
    expect(s.destination).toEqual({ code: 'GOA', name: 'Goa', kind: 'region' });
    expect(s.mainArea.name).toBe('Calangute Beach');
    expect(s.sights.length).toBeGreaterThanOrEqual(10);
    expect(s.guide?.dishes.map((d) => d.name)).toContain('Fish curry rice');
    expect(s.sampleData).toBe(true);
    expect(s.fetchedAt).toBe('2026-11-08T10:00:00.000Z');
  });

  test('a failing content provider leaves guide null but sights still show', async () => {
    const broken: ContentProvider = { id: 'broken', guide: () => Promise.reject(new Error('down')) };
    const set = { ...createRegistry({}, clock), content: [broken] };
    const s = await buildGuideSection(set, 'JAIPUR', { clock, timeoutMs: 1000 });
    expect(s.guide).toBeNull();
    expect(s.sights.length).toBeGreaterThan(0);
  });

  test('unknown destination throws', async () => {
    await expect(
      buildGuideSection(createRegistry({}, clock), 'NOWHERE', { clock, timeoutMs: 1000 }),
    ).rejects.toThrow();
  });
});
