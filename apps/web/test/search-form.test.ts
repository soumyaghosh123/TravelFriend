import { describe, expect, test } from 'vitest';
import {
  buildSearchInput,
  defaultFormState,
  issueFor,
  parsePrefill,
  prefillQuery,
  type PlaceOption,
  type SearchFormState,
} from '../lib/search-form-state';
import { todayInIndia } from '../lib/today';
import { defaultFareType, initialTravellers, travellersReducer } from '../lib/travellers';

const TODAY = '2026-11-08';
const KOL: PlaceOption = { code: 'KOL', name: 'Kolkata', kind: 'city', stations: ['HWH'], airports: ['CCU'], busPoints: [] };
const GOA: PlaceOption = { code: 'GOA', name: 'Goa', kind: 'region', stations: ['MAO'], airports: ['GOX'], busPoints: [] };

function briefExample(): SearchFormState {
  let t = initialTravellers();
  t = travellersReducer(t, { type: 'addChild' });
  t = travellersReducer(t, { type: 'childAge', index: 0, age: 3 });
  t = travellersReducer(t, { type: 'addChild' });
  t = travellersReducer(t, { type: 'childAge', index: 1, age: 6 });
  return { ...defaultFormState(TODAY), from: KOL, to: GOA, days: 10, month: '2026-12', travellers: t };
}

describe('travellers picker', () => {
  test('rooms follow the suggestion: 2 adults + kids 3 and 6 → 1 room; 4 adults → 2', () => {
    expect(briefExample().travellers.rooms).toBe(1);
    expect(travellersReducer(initialTravellers(), { type: 'adults', value: 4 }).rooms).toBe(2);
  });

  test('after a manual room change the suggestion stops, but rooms never exceed adults', () => {
    let t = travellersReducer(initialTravellers(2), { type: 'rooms', value: 2 });
    t = travellersReducer(t, { type: 'addChild' });
    expect(t.rooms).toBe(2);
    t = travellersReducer(t, { type: 'adults', value: 1 });
    expect(t.rooms).toBe(1);
    expect(travellersReducer(t, { type: 'rooms', value: 0 }).rooms).toBe(1);
  });

  test('adults stay between 1 and 20; children at most 10', () => {
    expect(travellersReducer(initialTravellers(1), { type: 'adults', value: 0 }).adults).toBe(1);
    expect(travellersReducer(initialTravellers(20), { type: 'adults', value: 21 }).adults).toBe(20);
    let t = initialTravellers();
    for (let i = 0; i < 12; i++) t = travellersReducer(t, { type: 'addChild' });
    expect(t.childAges).toHaveLength(10);
  });

  test('a new child has no age until one is picked', () => {
    expect(travellersReducer(initialTravellers(), { type: 'addChild' }).childAges).toEqual([null]);
  });

  test('default child fare bands: 3 free, 4 half, 7 half, 8 full', () => {
    expect([3, 4, 7, 8].map(defaultFareType)).toEqual(['free', 'half', 'half', 'full']);
  });
});

describe('buildSearchInput', () => {
  test('the brief example becomes a valid API request', () => {
    const r = buildSearchInput(briefExample(), TODAY);
    expect(r).toEqual({
      ok: true,
      input: {
        from: 'KOL',
        to: 'GOA',
        days: 10,
        month: '2026-12',
        hotelTypes: ['3-star', '4-star', '5-star'],
        travellers: { adults: 2, childAges: [3, 6], rooms: 1 },
      },
    });
  });

  test('missing places and missing child ages are reported per field', () => {
    const s = { ...defaultFormState(TODAY), travellers: travellersReducer(initialTravellers(), { type: 'addChild' }) };
    const r = buildSearchInput(s, TODAY);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(issueFor(r.issues, 'from')).toBe('from.required');
    expect(issueFor(r.issues, 'to')).toBe('to.required');
    expect(issueFor(r.issues, 'travellers')).toBe('childAge.required');
  });

  test('only chosen preferences are sent', () => {
    const s: SearchFormState = {
      ...briefExample(),
      preferences: { stayNear: '  ', travelMode: 'any', food: 'veg', interests: [], budget: 60000 },
    };
    const r = buildSearchInput(s, TODAY);
    expect(r.ok && r.input.preferences).toEqual({ food: 'veg', budget: 60000 });
  });

  test('default month is next month', () => {
    expect(defaultFormState(TODAY).month).toBe('2026-12');
    expect(defaultFormState('2026-12-31').month).toBe('2027-01');
  });
});

describe('URL prefill', () => {
  test('round-trips a search', () => {
    const r = buildSearchInput(briefExample(), TODAY);
    if (!r.ok) throw new Error('expected valid');
    const q = Object.fromEntries(new URLSearchParams(prefillQuery(r.input)));
    expect(parsePrefill(q)).toEqual({
      from: 'KOL',
      to: 'GOA',
      days: 10,
      month: '2026-12',
      hotelTypes: ['3-star', '4-star', '5-star'],
      adults: 2,
      childAges: [3, 6],
      rooms: 1,
    });
  });

  test('ignores malformed values', () => {
    expect(
      parsePrefill({ from: 'kol<script>', days: '99', month: '2026-13', hotel: 'motel', adults: '-1', children: '3,x' }),
    ).toEqual({});
  });
});

describe('todayInIndia', () => {
  test('rolls over at IST midnight', () => {
    expect(todayInIndia(new Date('2026-11-08T18:29:00Z'))).toBe('2026-11-08');
    expect(todayInIndia(new Date('2026-11-08T18:31:00Z'))).toBe('2026-11-09');
  });
});
