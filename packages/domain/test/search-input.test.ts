import { describe, expect, test } from 'vitest';
import {
  HOTEL_TYPES,
  latestStartDate,
  makeSearchInputSchema,
  type SearchInput,
} from '../src/search/search-input.js';

const TODAY = '2026-11-08';
const schema = makeSearchInputSchema(TODAY);

function valid(overrides: Partial<SearchInput> = {}): SearchInput {
  return {
    from: 'KOL',
    to: 'GOA',
    days: 10,
    month: '2026-12',
    hotelTypes: ['3-star', '4-star', '5-star'],
    travellers: { adults: 2, childAges: [3, 6], rooms: 1 },
    ...overrides,
  };
}

/** The message keys of every issue, so tests read like the UI's error list. */
function errors(input: unknown): string[] {
  const r = schema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe('search input schema', () => {
  test('accepts the brief example (Kolkata → Goa, 10 days, Dec 2026, 2 adults + kids 3 and 6)', () => {
    expect(errors(valid())).toEqual([]);
  });

  test('from and to are required and must differ', () => {
    expect(errors(valid({ from: '' }))).toContain('from.required');
    expect(errors(valid({ to: '' }))).toContain('to.required');
    expect(errors(valid({ to: 'KOL' }))).toContain('to.sameAsFrom');
  });

  test('days: 2 up to the length of the month', () => {
    expect(errors(valid({ days: 1 }))).toContain('days.range');
    expect(errors(valid({ days: 2 }))).toEqual([]);
    expect(errors(valid({ days: 31 }))).toEqual([]); // December has 31 days
    expect(errors(valid({ days: 32 }))).toContain('days.range');
    expect(errors(valid({ days: 29, month: '2027-02' }))).toContain('days.longerThanMonth');
    expect(errors(valid({ days: 28, month: '2027-02' }))).toEqual([]);
    expect(errors(valid({ days: 2.5 }))).toContain('days.range');
  });

  test('month must be YYYY-MM, not in the past, and within the next 12 months', () => {
    expect(errors(valid({ month: '2026-13' }))).toContain('month.format');
    expect(errors(valid({ month: 'Dec 2026' }))).toContain('month.format');
    expect(errors(valid({ month: '2026-10' }))).toContain('month.past');
    expect(errors(valid({ month: '2027-10' }))).toEqual([]);
    expect(errors(valid({ month: '2027-11' }))).toContain('month.tooFar');
  });

  test('the current month is allowed only while a full trip still fits before month end', () => {
    // Nov 2026 has 30 days; today is the 8th. A 23-day trip can start on the 8th; 24 days cannot.
    expect(errors(valid({ month: '2026-11', days: 23 }))).toEqual([]);
    expect(errors(valid({ month: '2026-11', days: 24 }))).toContain('month.noWindowLeft');
  });

  test('at least one hotel type from the known list', () => {
    expect(errors(valid({ hotelTypes: [] }))).toContain('hotelTypes.min');
    expect(errors(valid({ hotelTypes: [...HOTEL_TYPES] }))).toEqual([]);
    expect(schema.safeParse(valid({ hotelTypes: ['motel' as never] })).success).toBe(false);
  });

  test('head count: 1–20 adults, child ages 0–17, at most 20 travellers', () => {
    expect(errors(valid({ travellers: { adults: 0, childAges: [], rooms: 1 } }))).toContain('adults.range');
    expect(errors(valid({ travellers: { adults: 2, childAges: [18], rooms: 1 } }))).toContain('childAge.range');
    expect(errors(valid({ travellers: { adults: 2, childAges: [-1], rooms: 1 } }))).toContain('childAge.range');
    expect(errors(valid({ travellers: { adults: 2, childAges: [0, 17], rooms: 1 } }))).toEqual([]);
    expect(errors(valid({ travellers: { adults: 15, childAges: [1, 2, 3, 4, 5, 6], rooms: 8 } }))).toContain(
      'travellers.max',
    );
  });

  test('rooms: at least 1, at most one per adult', () => {
    expect(errors(valid({ travellers: { adults: 2, childAges: [], rooms: 0 } }))).toContain('rooms.range');
    expect(errors(valid({ travellers: { adults: 2, childAges: [5], rooms: 3 } }))).toContain('rooms.range');
    expect(errors(valid({ travellers: { adults: 2, childAges: [5], rooms: 2 } }))).toEqual([]);
  });

  test('rooms default to the suggestion when left out', () => {
    const r = schema.parse(valid({ travellers: { adults: 4, childAges: [10] } }));
    expect(r.travellers.rooms).toBe(3); // 5 adult-like people → ceil(5/2)
  });

  test('more preferences are optional and validated when present', () => {
    expect(errors(valid({ preferences: {} }))).toEqual([]);
    expect(
      errors(
        valid({
          preferences: {
            stayNear: 'Calangute Beach',
            budget: 60000,
            travelMode: 'train',
            ac: 'ac',
            berth: 'sleeper',
            food: 'veg',
            companions: ['kids'],
            interests: ['beaches', 'shopping', 'nature'],
          },
        }),
      ),
    ).toEqual([]);
    expect(errors(valid({ preferences: { budget: 0 } }))).toContain('budget.range');
    expect(errors(valid({ preferences: { budget: 1500.5 } }))).toContain('budget.range');
    expect(errors(valid({ preferences: { stayNear: 'x'.repeat(81) } }))).toContain('stayNear.max');
  });

  test('trims place codes and the landmark', () => {
    const r = schema.parse(valid({ from: ' KOL ', preferences: { stayNear: '  Baga  ' } }));
    expect(r.from).toBe('KOL');
    expect(r.preferences?.stayNear).toBe('Baga');
  });
});

describe('latestStartDate', () => {
  test('last start date that keeps an N-day trip inside the month', () => {
    expect(latestStartDate('2026-12', 10)).toBe('2026-12-22');
    expect(latestStartDate('2027-02', 28)).toBe('2027-02-01');
  });
});
