import { computeWindows } from '@tripsaver/domain';
import { describe, expect, test } from 'vitest';
import { buildCheapestDatesInput } from '../src/assemble.js';
import { fixedClock } from '../src/clock.js';
import { mockPlaceDirectory } from '../src/mock/data/places.js';
import { ROUTES } from '../src/mock/data/routes.js';
import { createRegistry } from '../src/registry.js';

// "From" accepts any place we know, so every place needs journeys to every destination (sample data).
describe('sample routes cover every From → To pair', () => {
  const places = mockPlaceDirectory.places();
  const destinations = places.filter((p) => mockPlaceDirectory.isDestination(p.code));

  test('each place has at least one route to and from every other destination', () => {
    const missing: string[] = [];
    for (const from of places)
      for (const to of destinations) {
        if (from.code === to.code) continue;
        if (!ROUTES.some((r) => r.from === from.code && r.to === to.code))
          missing.push(`${from.code}→${to.code}`);
        if (!ROUTES.some((r) => r.from === to.code && r.to === from.code))
          missing.push(`${to.code}→${from.code}`);
      }
    expect(missing).toEqual([]);
  });

  test('no trains where there is no station; no buses across the sea to the Andamans', () => {
    expect(ROUTES.filter((r) => r.mode === 'train' && (r.from === 'LEH' || r.to === 'LEH'))).toEqual([]);
    expect(ROUTES.filter((r) => r.mode !== 'flight' && (r.from === 'ANDAMAN' || r.to === 'ANDAMAN'))).toEqual(
      [],
    );
  });

  test('route ids are unique', () => {
    expect(new Set(ROUTES.map((r) => r.id)).size).toBe(ROUTES.length);
  });

  test('Jaipur → Goa, 5 days in December 2026: there are dates that work', async () => {
    const set = createRegistry({}, fixedClock('2026-11-10T06:00:00Z'));
    const input = await buildCheapestDatesInput(set, {
      from: 'JAIPUR',
      to: 'GOA',
      year: 2026,
      month: 12,
      days: 5,
      travellers: { adults: 2, childAges: [] },
      style: 'budget',
      localPerDay: 1500,
    });
    expect(computeWindows(input).filter((w) => w.feasible).length).toBeGreaterThan(10);
  });
});
