import { makeSearchInputSchema, type ValidSearchInput } from '@tripsaver/domain';
import { describe, expect, test } from 'vitest';
import type { TripStyle } from '../src/assemble.js';
import { fixedClock } from '../src/clock.js';
import { buildPlanCost, hotelsForWindow } from '../src/cost-section.js';
import { buildDatesSection } from '../src/dates-section.js';
import { buildItinerarySection } from '../src/itinerary-section.js';
import { MockAttractionsProvider } from '../src/mock/attractions.js';
import { createRegistry } from '../src/registry.js';

// PLAN §12 step 9, done when: "Totals reconcile".
const clock = fixedClock('2026-11-08T06:00:00Z');
const set = createRegistry({}, clock);
const opts = { clock, timeoutMs: 4000 };

async function setup(to: string, days: number, style: TripStyle) {
  const input: ValidSearchInput = makeSearchInputSchema('2026-11-08').parse({
    from: 'KOL',
    to,
    days,
    month: '2026-12',
    hotelTypes: ['3-star'],
    travellers: { adults: 2, childAges: [3, 6] },
    ...(to === 'GOA' ? { preferences: { stayNear: 'Calangute' } } : {}),
  });
  const dates = await buildDatesSection(set, input, { today: '2026-11-08', clock, timeoutMs: 4000 });
  const w = dates.styles.find((s) => s.style === style)!.top[0]!;
  return { input, w };
}

describe('cost summary reconciles with the other tabs', () => {
  test.each([
    ['GOA', 10, 'budget'],
    ['GOA', 10, 'comfort'],
    ['KERALA', 9, 'budget'],
    ['MANALI', 6, 'offbeat'],
  ] as const)('%s %i days %s', async (to, days, style) => {
    const { input, w } = await setup(to, days, style);
    const hotels = await hotelsForWindow(set, input, w, opts);
    const view = await buildPlanCost(set, input, style, w, opts, hotels);
    const plan = await buildItinerarySection(set, input, style, w, hotels, opts);
    if (!view.available || !plan.available) throw new Error('expected a plan');
    const c = view.cost;

    // Rows add up.
    expect(c.transport + c.hotels + c.local + c.sights + c.food + c.buffer).toBe(c.total);
    expect(c.perPerson).toBe(Math.round(c.total / 4));
    // Transport = the plan's legs on "Getting there".
    expect(c.transport).toBe(w.onward.price.amount + w.return.price.amount);
    // Hotels = the plan's hotel at each base (Day-by-day).
    expect(c.hotels).toBe(plan.bases.reduce((s, b) => s + (b.hotelTotal ?? 0), 0));
    // Local, sights, food = the sum of the day spends (Day-by-day); local = the Local transport tab's choices.
    expect(c.local).toBe(plan.days.reduce((s, d) => s + d.spend.local, 0));
    expect(c.sights).toBe(plan.days.reduce((s, d) => s + d.spend.entry, 0));
    expect(c.food).toBe(plan.days.reduce((s, d) => s + d.spend.meals, 0));
    expect(c.local).toBe(plan.local.legs.reduce((s, l) => s + Math.round((l.plan.min + l.plan.max) / 2), 0));

    // Checklist: both legs and every hotel, at the same amounts as the table.
    const kinds = view.checklist.map((i) => i.kind);
    expect(view.checklist[0]).toMatchObject({ kind: 'transport', direction: 'onward' });
    expect(view.checklist.at(-1)).toMatchObject({ kind: 'transport', direction: 'return' });
    const sum = (k: string) => view.checklist.filter((i) => i.kind === k).reduce((s, i) => s + i.amount, 0);
    expect(sum('transport')).toBe(c.transport);
    expect(sum('hotel')).toBe(c.hotels);
    expect(kinds.filter((k) => k === 'hotel')).toHaveLength(plan.bases.filter((b) => b.hotel).length);
    // Tickets are part of sights; extras (ferry, jeep) part of local.
    expect(sum('ticket')).toBeLessThanOrEqual(c.sights);
    expect(sum('local-extra')).toBeLessThanOrEqual(c.local);
    // Item ids are unique (they key the "booked" tick boxes).
    expect(new Set(view.checklist.map((i) => i.id)).size).toBe(view.checklist.length);
    for (const i of view.checklist)
      if (i.kind === 'transport' || i.kind === 'hotel') expect(i.offer.bookingUrl).toMatch(/^https:\/\//);

    if (style === 'comfort') {
      expect(view.fiveStar).not.toBeNull();
      expect(view.fiveStar!.hotels).toBeGreaterThan(c.hotels);
      expect(view.fiveStar!.transport).toBe(c.transport);
    } else expect(view.fiveStar).toBeNull();
  });

  test('Offbeat where there are no offbeat places → not available (no made-up total)', async () => {
    const noOffbeat = new MockAttractionsProvider();
    const original = noOffbeat.attractions.bind(noOffbeat);
    noOffbeat.attractions = async (d) => (await original(d)).filter((a) => d !== 'JAIPUR' || !a.isOffbeat);
    const s2 = { ...set, attractions: [noOffbeat] };
    const { input, w } = await setup('JAIPUR', 6, 'offbeat');
    expect(await buildPlanCost(s2, input, 'offbeat', w, opts, null)).toEqual({
      style: 'offbeat',
      available: false,
    });
  });
});
