import { describe, expect, test } from 'vitest';
import { DEFAULT_PRICING_RULES, fareTypeForAge, validateTravellers } from '../src/pricing/rules.js';
import { priceForGroup } from '../src/pricing/group-price.js';
import { suggestRooms } from '../src/pricing/rooms.js';
import type { PricingRule } from '../src/types.js';

describe('fareTypeForAge – default bands', () => {
  test.each([
    [0, 'free'],
    [3, 'free'],
    [4, 'half'],
    [7, 'half'],
    [8, 'full'],
    [17, 'full'],
  ])('age %i → %s', (age, fare) => {
    expect(fareTypeForAge(age, 'train', 'irctc', DEFAULT_PRICING_RULES).fareType).toBe(fare);
  });

  test('a provider-specific rule beats the default only for that provider', () => {
    const indigo: PricingRule = {
      mode: 'flight',
      providerId: 'indigo',
      minAge: 2,
      maxAge: 11,
      multiplier: 0.75,
      fareType: 'half',
    };
    const rules = [...DEFAULT_PRICING_RULES, indigo];
    expect(fareTypeForAge(3, 'flight', 'indigo', rules).multiplier).toBe(0.75);
    expect(fareTypeForAge(3, 'flight', 'spicejet', rules).fareType).toBe('free');
  });
});

describe('priceForGroup', () => {
  const brief = { adults: 2, childAges: [3, 6] };

  test('brief example: 2 adults + 3 y (free) + 6 y (half) on a ₹2,650 3A fare = ₹6,625', () => {
    const g = priceForGroup({ mode: 'train', providerId: 'irctc', adultUnitPrice: 2650, travellers: brief });
    expect(g.total).toBe(6625);
    expect(g.lines.map((l) => l.amount)).toEqual([5300, 0, 1325]);
    expect(g.lines.map((l) => l.label)).toEqual(['Adult', 'Infant (3 y)', 'Child (6 y)']);
    expect(g.isEstimate).toBe(true);
    expect(g.lines[0]!.isEstimate).toBe(false);
  });

  test("the provider's own child prices replace the default rule and are not estimates", () => {
    const g = priceForGroup({
      mode: 'train',
      providerId: 'irctc',
      adultUnitPrice: 2650,
      travellers: brief,
      providerChildPrices: { 6: 1500, 3: 0 },
    });
    expect(g.total).toBe(6800);
    expect(g.lines.every((l) => !l.isEstimate)).toBe(true);
    expect(g.isEstimate).toBe(false);
  });

  test('half fares round to whole rupees', () => {
    const g = priceForGroup({
      mode: 'bus',
      providerId: 'x',
      adultUnitPrice: 1005,
      travellers: { adults: 1, childAges: [5] },
    });
    expect(g.lines[1]!.amount).toBe(503);
  });
});

describe('validateTravellers', () => {
  test.each([
    [{ adults: 0, childAges: [] }],
    [{ adults: 2, childAges: [-1] }],
    [{ adults: 2, childAges: [2.5] }],
    [{ adults: 2, childAges: [18] }],
  ])('rejects %j', (t) => {
    expect(() => validateTravellers(t)).toThrow(RangeError);
  });

  test('priceForGroup validates first', () => {
    expect(() =>
      priceForGroup({ mode: 'hotel', providerId: 'x', adultUnitPrice: 100, travellers: { adults: 0, childAges: [] } }),
    ).toThrow(RangeError);
  });
});

describe('suggestRooms', () => {
  test.each([
    [{ adults: 2, childAges: [3, 6] }, 1],
    [{ adults: 3, childAges: [] }, 2],
    [{ adults: 2, childAges: [2, 4, 6] }, 2],
    [{ adults: 2, childAges: [9, 10] }, 2],
    [{ adults: 1, childAges: [] }, 1],
  ])('%j → %i', (t, rooms) => {
    expect(suggestRooms(t)).toBe(rooms);
  });
});
