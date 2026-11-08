import { describe, expect, test } from 'vitest';
import { compareMonths, computeWindows, diffDays, explainWindow, topWindows } from '@tripsaver/domain';
import { buildCheapestDatesInput } from '../src/assemble.js';
import { fixedClock } from '../src/clock.js';
import { createRegistry } from '../src/registry.js';

describe('Brief §12: Kolkata → Goa, 10 days, December 2026, 2 adults + children aged 3 and 6', () => {
  const set = createRegistry({}, fixedClock('2026-11-08T10:00:00Z'));
  const args = {
    from: 'KOL',
    to: 'GOA',
    year: 2026,
    month: 12,
    days: 10,
    travellers: { adults: 2, childAges: [3, 6] },
    style: 'budget' as const,
    localPerDay: 1500,
  };

  test('cheapest windows avoid the Christmas–New Year peak, and the peak is explained', async () => {
    const input = await buildCheapestDatesInput(set, args);
    const ws = computeWindows(input);
    expect(ws).toHaveLength(22);
    const feasible = ws.filter((w) => w.feasible);
    expect(feasible.length).toBeGreaterThanOrEqual(18);

    const top = topWindows(ws);
    expect(top).toHaveLength(3);
    for (const t of top) expect(t.start < '2026-12-20').toBe(true);
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++)
        expect(Math.abs(diffDays(top[i]!.start, top[j]!.start))).toBeGreaterThanOrEqual(3);

    const worst = feasible.reduce((a, b) => (b.total > a.total ? b : a));
    const events = await set.calendar[0]!.events('GOA', 2026, 12);
    expect(explainWindow(worst, events).some((r) => /Christmas/.test(r.text))).toBe(true);

    for (const w of feasible) {
      const b = w.breakdown;
      expect(b.onward + b.return + b.hotel + b.local).toBe(w.total);
    }
  });

  test('December is peak in Goa and a cheaper month exists', async () => {
    const climate = await set.weather[0]!.climate('GOA');
    const r = compareMonths(climate, 12);
    expect(r.months[11]!.label).toBe('peak');
    expect(r.bestAlternative).not.toBeNull();
  });

  test('comfort style costs more than budget for the same dates', async () => {
    const budget = topWindows(computeWindows(await buildCheapestDatesInput(set, args)))[0]!;
    const comfort = topWindows(computeWindows(await buildCheapestDatesInput(set, { ...args, style: 'comfort' })))[0]!;
    expect(comfort.total).toBeGreaterThan(budget.total);
  });
});
