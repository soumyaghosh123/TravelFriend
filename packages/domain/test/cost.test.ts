import { describe, expect, test } from 'vitest';
import { planCost, SHOPPING_BUFFER_PCT, sumDaySpends } from '../src/cost/cost.js';

const family = { adults: 2, childAges: [3, 6] };

describe('sumDaySpends', () => {
  test('adds each day’s local travel, entry fees and meals', () => {
    const days = [
      { spend: { entry: 0, local: 300, meals: 1200, total: 1500 } },
      { spend: { entry: 450, local: 620, meals: 1600, total: 2670 } },
    ];
    expect(sumDaySpends(days)).toEqual({ local: 920, sights: 450, food: 2800 });
  });
});

describe('planCost (PLAN §6.7)', () => {
  const lines = { transport: 13250, hotels: 11550, local: 4200, sights: 1600, food: 5300 };

  test('rows add up to the total; a shopping buffer on top, rounded up to ₹100', () => {
    const c = planCost(lines, 'budget', family);
    const subtotal = 13250 + 11550 + 4200 + 1600 + 5300;
    expect(c.buffer).toBe(Math.ceil((subtotal * SHOPPING_BUFFER_PCT.budget) / 100) * 100);
    expect(c.total).toBe(subtotal + c.buffer);
    expect(c.transport + c.hotels + c.local + c.sights + c.food + c.buffer).toBe(c.total);
  });

  test('per person divides by everyone travelling (the mockup’s ÷4)', () => {
    const c = planCost(lines, 'budget', family);
    expect(c.people).toBe(4);
    expect(c.perPerson).toBe(Math.round(c.total / 4));
  });

  test('offbeat keeps a larger buffer for local crafts; nothing to buy → no buffer', () => {
    expect(SHOPPING_BUFFER_PCT.offbeat).toBeGreaterThan(SHOPPING_BUFFER_PCT.budget);
    expect(
      planCost({ transport: 0, hotels: 0, local: 0, sights: 0, food: 0 }, 'offbeat', family).buffer,
    ).toBe(0);
  });
});
