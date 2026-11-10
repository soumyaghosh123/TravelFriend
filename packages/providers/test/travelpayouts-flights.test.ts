import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { fixedClock, type Clock } from '../src/clock.js';
import { aviasalesLink } from '../src/deeplinks/index.js';
import type { FlightProvider } from '../src/interfaces.js';
import { MockFlightProvider } from '../src/mock/transport.js';
import { parseTravelpayouts } from '../src/real/travelpayouts-parse.js';
import { TravelpayoutsFlightProvider } from '../src/real/travelpayouts-flights.js';
import { createRegistry } from '../src/registry.js';
import { expectPricedOffer } from './helpers.js';

// A real Travelpayouts v3 prices_for_dates reply (CCU → GOI, Dec 2026), links trimmed. Tests never call the network.
const fixture = readFileSync(new URL('./fixtures/travelpayouts-ccu-goi-2026-12.json', import.meta.url), 'utf8');
const empty = JSON.stringify({ success: true, data: [], currency: 'inr' });
const clock = fixedClock('2026-11-10T06:00:00Z');
const two = { adults: 2, childAges: [] };

type FetchMock = typeof fetch & ReturnType<typeof vi.fn>;
/** Answers CCU → GOI with the fixture and every other airport pair with no data. */
const replies = (body: (url: URL) => string | Error = (u) =>
  u.searchParams.get('origin') === 'CCU' && u.searchParams.get('destination') === 'GOI' ? fixture : empty) =>
  vi.fn(async (input: string | URL | Request) => {
    const b = body(new URL(String(input)));
    if (b instanceof Error) throw b;
    return new Response(b, { status: 200 });
  }) as unknown as FetchMock;

const tp = (f: typeof fetch, c: Clock = clock) =>
  new TravelpayoutsFlightProvider({
    clock: c,
    token: 'test-token',
    marker: '803441',
    fetch: f,
    fallback: new MockFlightProvider(c),
  });

describe.each<[string, () => FlightProvider]>([
  ['mock', () => new MockFlightProvider(clock)],
  ['travelpayouts', () => tp(replies())],
])('FlightProvider contract: %s', (_name, make) => {
  test('search() gives priced flight offers with source, fetchedAt and a booking link', async () => {
    const offers = await make().search({ from: 'KOL', to: 'GOA', date: '2026-12-16', travellers: two });
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expectPricedOffer(o);
      expect(o.mode).toBe('flight');
      expect(o.departDate).toBe('2026-12-16');
    }
  });

  test('cheapestByDate() covers every day of the month', async () => {
    const grid = await make().cheapestByDate({ from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers: two });
    expect(Object.keys(grid)).toHaveLength(31);
  });
});

describe('parseTravelpayouts', () => {
  test('reads fares in local time with arrival worked out from the duration', () => {
    const fares = parseTravelpayouts(JSON.parse(fixture));
    expect(fares).toHaveLength(12);
    expect(fares.find((f) => f.date === '2026-12-16')).toEqual({
      date: '2026-12-16',
      departAt: '2026-12-16T18:50',
      arriveAt: '2026-12-16T21:40',
      arriveDate: '2026-12-16',
      airline: '6E',
      flightNumber: '258',
      originAirport: 'CCU',
      destinationAirport: 'GOX',
      price: 8384,
      durationMin: 170,
      transfers: 0,
    });
  });

  test('an arrival after midnight moves to the next day', () => {
    const [f] = parseTravelpayouts({
      success: true,
      data: [
        {
          origin_airport: 'DEL', destination_airport: 'GOI', departure_at: '2026-12-02T21:10:00+05:30',
          airline: 'AI', flight_number: '883', price: 6000, duration: 570, transfers: 1,
        },
      ],
    });
    expect(f).toMatchObject({ arriveAt: '2026-12-03T06:40', arriveDate: '2026-12-03' });
  });

  test.each([
    ['a refusal', { success: false, error: 'Unauthorized', data: null }],
    ['a missing data list', { success: true }],
  ])('throws on %s', (_n, body) => {
    expect(() => parseTravelpayouts(body)).toThrow();
  });

  test('skips rows without a positive whole price or a valid time', () => {
    const fares = parseTravelpayouts({
      success: true,
      data: [
        { origin_airport: 'CCU', destination_airport: 'GOI', departure_at: 'soon', airline: '6E', price: 5000, duration: 170 },
        { origin_airport: 'CCU', destination_airport: 'GOI', departure_at: '2026-12-05T10:00:00+05:30', airline: '6E', price: 0, duration: 170 },
      ],
    });
    expect(fares).toEqual([]);
  });
});

describe('aviasalesLink', () => {
  test('route, date, adults, children and infants in the path; Partner ID as marker', () => {
    const url = new URL(
      aviasalesLink({ from: 'CCU', to: 'GOI', date: '2026-12-16', travellers: { adults: 2, childAges: [1, 6, 13] }, marker: '803441' }),
    );
    // 13-year-olds fly as adults; 2–11 are children; under 2 are infants.
    expect(url.origin + url.pathname).toBe('https://www.aviasales.com/search/CCU1612GOI311');
    expect(url.searchParams.get('marker')).toBe('803441');
  });
});

describe('TravelpayoutsFlightProvider', () => {
  test('cheapest flight per day from one request per airport pair; days without data stay empty', async () => {
    const f = replies();
    const grid = await tp(f).cheapestByDate({ from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers: two });
    expect(grid['2026-12-16']).toMatchObject({
      source: 'travelpayouts',
      sourceName: 'Aviasales',
      operator: 'IndiGo',
      number: '6E 258',
      travelClass: 'Economy',
      fromPoint: 'CCU',
      toPoint: 'GOX',
      price: { amount: 16768, currency: 'INR' },
      perPerson: { amount: 8384, currency: 'INR' },
      isEstimate: true,
      prefilled: true,
      fetchedAt: '2026-11-10T06:00:00.000Z',
    });
    expect(grid['2026-12-16']!.bookingUrl).toContain('/search/CCU1612GOI2');
    expect(grid['2026-12-03']).toBeUndefined();
    // Goa has two airports (GOI, GOX): one request each, for the whole month.
    expect(f).toHaveBeenCalledTimes(2);
    const url = new URL(String(f.mock.calls[0]![0]));
    expect(url.pathname).toBe('/aviasales/v3/prices_for_dates');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      origin: 'CCU', departure_at: '2026-12', one_way: 'true', currency: 'inr', sorting: 'price',
    });
    expect((f.mock.calls[0]![1] as RequestInit).headers).toMatchObject({ 'X-Access-Token': 'test-token' });
  });

  test('search() on a date reuses the month already fetched', async () => {
    const f = replies();
    const p = tp(f);
    await p.cheapestByDate({ from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers: two });
    const offers = await p.search({ from: 'KOL', to: 'GOA', date: '2026-12-06', travellers: two });
    expect(offers.map((o) => o.price.amount)).toEqual([17464]);
    expect(await p.search({ from: 'KOL', to: 'GOA', date: '2026-12-03', travellers: two })).toEqual([]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('children use the default child rules and make the price approx.', async () => {
    const grid = await tp(replies()).cheapestByDate({
      from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers: { adults: 2, childAges: [6] },
    });
    // Defaults: 4–7 pay half (no airline child price in this data).
    expect(grid['2026-12-16']!.price.amount).toBe(8384 * 2 + 4192);
    expect(grid['2026-12-16']!.breakdown!.some((l) => l.isEstimate)).toBe(true);
  });

  test('the same airline flight from two airport queries is counted once', async () => {
    const both = replies(() => fixture);
    const offers = await tp(both).search({ from: 'KOL', to: 'GOA', date: '2026-12-16', travellers: two });
    expect(offers).toHaveLength(1);
  });

  test('a month is cached for 6 hours, then fetched again', async () => {
    let now = new Date('2026-11-10T06:00:00Z');
    const f = replies();
    const p = tp(f, () => now);
    const q = { from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers: two };
    await p.cheapestByDate(q);
    now = new Date('2026-11-10T11:59:00Z');
    await p.cheapestByDate(q);
    expect(f).toHaveBeenCalledTimes(2);
    now = new Date('2026-11-10T12:01:00Z');
    await p.cheapestByDate(q);
    expect(f).toHaveBeenCalledTimes(4);
  });

  test('no data for the whole route-month → sample flights (labelled by their own source)', async () => {
    const grid = await tp(replies(() => empty)).cheapestByDate({
      from: 'KOL', to: 'GOA', year: 2026, month: 12, travellers: two,
    });
    const offers = Object.values(grid).filter(Boolean);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o!.source === 'mock-flight')).toBe(true);
  });

  test('Travelpayouts failing → sample flights, and no new request for 5 minutes', async () => {
    let now = new Date('2026-11-10T06:00:00Z');
    const f = replies(() => new Error('network down'));
    const p = tp(f, () => now);
    const offers = await p.search({ from: 'KOL', to: 'GOA', date: '2026-12-16', travellers: two });
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.source === 'mock-flight')).toBe(true);
    const calls = f.mock.calls.length;
    now = new Date('2026-11-10T06:04:00Z');
    await p.search({ from: 'KOL', to: 'GOA', date: '2026-12-17', travellers: two });
    expect(f.mock.calls.length).toBe(calls);
    now = new Date('2026-11-10T06:06:00Z');
    await p.search({ from: 'KOL', to: 'GOA', date: '2026-12-17', travellers: two });
    expect(f.mock.calls.length).toBeGreaterThan(calls);
  });

  test('an HTTP error or a refusal inside a 200 counts as a failure', async () => {
    for (const res of [
      new Response('nope', { status: 401 }),
      new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 200 }),
    ]) {
      const f = vi.fn(async () => res.clone()) as unknown as FetchMock;
      const offers = await tp(f).search({ from: 'KOL', to: 'GOA', date: '2026-12-16', travellers: two });
      expect(offers.every((o) => o.source === 'mock-flight')).toBe(true);
    }
  });

  test('places without an airport get the sample flights without any request', async () => {
    const f = replies();
    const p = new TravelpayoutsFlightProvider({
      clock,
      token: 't',
      marker: 'm',
      fetch: f,
      fallback: new MockFlightProvider(clock),
      places: { get: (code: string) => (code === 'KOL' ? { airports: ['CCU'] } : { airports: [] }) } as never,
    });
    await p.search({ from: 'KOL', to: 'GOA', date: '2026-12-16', travellers: two });
    expect(f).not.toHaveBeenCalled();
  });
});

describe('registry', () => {
  test('FLIGHT_PROVIDERS=travelpayouts needs the token and marker', () => {
    expect(() => createRegistry({ FLIGHT_PROVIDERS: 'travelpayouts' })).toThrow(/TRAVELPAYOUTS_TOKEN/);
    const set = createRegistry({
      FLIGHT_PROVIDERS: 'travelpayouts',
      TRAVELPAYOUTS_TOKEN: 't',
      TRAVELPAYOUTS_MARKER: 'm',
    });
    expect(set.flight.map((p) => p.id)).toEqual(['travelpayouts']);
  });
});
