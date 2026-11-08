import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createRegistry, fixedClock, type DatesSection, type HotelsSection, type ProviderSet, type TransportSection } from '@tripsaver/providers';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { CLOCK, PROVIDER_SET } from '../src/tokens.js';

const clock = fixedClock('2026-11-08T06:00:00Z');
const briefExample = {
  from: 'KOL',
  to: 'GOA',
  days: 10,
  month: '2026-12',
  hotelTypes: ['3-star', '4-star', '5-star'],
  travellers: { adults: 2, childAges: [3, 6] },
};

interface SseEvent {
  event: string;
  data: { status?: string; data?: unknown; message?: string; sections?: string[] };
}

function parseSse(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((b) => b.trim())
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((l) => l.startsWith('event: '))!.slice(7);
      const data = JSON.parse(lines.find((l) => l.startsWith('data: '))!.slice(6)) as SseEvent['data'];
      return { event, data };
    });
}

async function makeApp(providers?: ProviderSet): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] }).overrideProvider(CLOCK).useValue(clock);
  if (providers) builder = builder.overrideProvider(PROVIDER_SET).useValue(providers);
  const app = (await builder.compile()).createNestApplication();
  configureApp(app, {});
  await app.init();
  return app;
}

async function stream(app: INestApplication, id: string): Promise<SseEvent[]> {
  const res = await request(app.getHttpServer())
    .get(`/api/search/${id}/stream`)
    .buffer(true)
    .parse((r, cb) => {
      let body = '';
      r.on('data', (c: Buffer) => (body += c.toString()));
      r.on('end', () => cb(null, body));
    })
    .expect(200)
    .expect('content-type', /text\/event-stream/);
  return parseSse(res.body as string);
}

describe('results stream — brief §12: Kolkata → Goa, 10 days, Dec 2026, 2 adults + kids 3 and 6', () => {
  let app: INestApplication;
  let id: string;
  let dates: DatesSection;
  let transport: TransportSection;
  let hotels: HotelsSection;

  beforeAll(async () => {
    app = await makeApp();
    id = (await request(app.getHttpServer()).post('/api/search').send(briefExample).expect(201)).body.searchId;
    const events = await stream(app, id);
    // dates first, done last; the others arrive as they complete.
    expect(events[0]!.event).toBe('dates');
    expect(events.at(-1)!.event).toBe('done');
    expect(events.map((e) => e.event).sort()).toEqual(['dates', 'done', 'hotels', 'transport']);
    const get = (name: string) => events.find((e) => e.event === name)!.data;
    for (const name of ['dates', 'transport', 'hotels']) expect(get(name).status).toBe('ok');
    dates = get('dates').data as DatesSection;
    transport = get('transport').data as TransportSection;
    hotels = get('hotels').data as HotelsSection;
  });

  test('hotels are streamed for the Budget plan’s stay (arrival → return departure), with per-site prices', () => {
    const best = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
    expect(hotels.checkIn).toBe(best.onward.arriveDate);
    expect(hotels.checkOut).toBe(best.return.departDate);
    expect(hotels.nights).toBe(best.hotelNights);
    expect(hotels.hotels.length).toBeGreaterThan(10);
    // The plan's hotel is one of the listed ones, at the same price.
    const planHotel = hotels.hotels.find((h) => h.hotelId === best.hotel!.hotelId)!;
    expect(planHotel.totalPrice).toBe(best.hotel!.cheapest.price.amount);
  });

  test('hotels endpoint: another stay; bad or too-long stays → 400', async () => {
    const res = await request(app.getHttpServer()).get(`/api/search/${id}/hotels?checkIn=2026-12-03&checkOut=2026-12-10`).expect(200);
    expect(res.body.nights).toBe(7);
    await request(app.getHttpServer()).get(`/api/search/${id}/hotels?checkIn=2026-12-03`).expect(400);
    await request(app.getHttpServer()).get(`/api/search/${id}/hotels?checkIn=2026-12-10&checkOut=2026-12-03`).expect(400);
    await request(app.getHttpServer()).get(`/api/search/${id}/hotels?checkIn=2026-12-01&checkOut=2026-12-11`).expect(400); // 10 nights > 9
    await request(app.getHttpServer()).get(`/api/search/${id}/hotels?checkIn=2026-11-28&checkOut=2026-12-02`).expect(400);
  });

  test('transport is streamed for the Budget plan’s cheapest dates, both directions, with fares and links', () => {
    const best = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
    expect(transport.onward.date).toBe(best.onward.departDate);
    expect(transport.return.date).toBe(best.return.departDate);
    for (const d of [transport.onward, transport.return]) {
      expect(d.services.length).toBeGreaterThan(0);
      for (const o of d.services.flatMap((s) => s.offers)) {
        expect(o.price.amount).toBeGreaterThan(0);
        expect(o.bookingUrl).toMatch(/^https:\/\//);
      }
    }
    // The plan's chosen legs are among the listed options.
    const listed = transport.onward.services.flatMap((s) => s.offers).map((o) => `${o.departAt}|${o.travelClass}`);
    expect(listed).toContain(`${best.onward.departAt}|${best.onward.travelClass}`);
  });

  test('transport endpoint: other dates; bad or out-of-month dates → 400', async () => {
    const res = await request(app.getHttpServer()).get(`/api/search/${id}/transport?onward=2026-12-03&return=2026-12-11`).expect(200);
    expect(res.body.onward.date).toBe('2026-12-03');
    expect(res.body.return.date).toBe('2026-12-11');
    await request(app.getHttpServer()).get(`/api/search/${id}/transport?onward=2026-12-03`).expect(400);
    await request(app.getHttpServer()).get(`/api/search/${id}/transport?onward=2026-12-25&return=2026-12-30`).expect(400); // 10 days runs into January
    await request(app.getHttpServer()).get(`/api/search/${id}/transport?onward=2026-12-05&return=2026-12-04`).expect(400);
    await request(app.getHttpServer()).get(`/api/search/${id}/transport?onward=2026-12-01&return=2026-12-12`).expect(400); // longer than 10 days
  });

  afterAll(async () => {
    await app.close();
  });

  test('a calendar cell for every start date that fits in December (1–22)', () => {
    for (const s of dates.styles) {
      expect(s.cells).toHaveLength(22);
      expect(s.cells[0]!.start).toBe('2026-12-01');
      expect(s.cells.at(-1)!.end).toBe('2026-12-31');
    }
  });

  test('December shows the peak warning, naming Christmas–New Year, with a cheaper month', () => {
    expect(dates.peakWarning?.isPeakMonth).toBe(true);
    expect(dates.peakWarning?.strongestEvent?.name).toMatch(/Christmas/);
    expect(dates.bestAlternative?.month).toBe('2027-02'); // nearby and still bookable, not the monsoon
    expect(dates.months).toHaveLength(12);
  });

  test('top 3 budget windows avoid the peak, save money, and add up from bookable offers', () => {
    const budget = dates.styles.find((s) => s.style === 'budget')!;
    expect(budget.top).toHaveLength(3);
    for (const w of budget.top) {
      expect(w.start < '2026-12-20').toBe(true);
      expect(w.saving).toBeGreaterThan(0);
      expect(w.total).toBe(w.onward.price.amount + w.return.price.amount + (w.hotel?.cheapest.price.amount ?? 0) + w.local.amount);
      expect(w.onward.bookingUrl).toMatch(/^https:\/\//);
      expect(w.onward.fetchedAt).toBe('2026-11-08T06:00:00.000Z');
    }
    expect(budget.mostExpensive?.reasons.some((r) => r.event?.name.match(/Christmas/))).toBe(true);
    expect(budget.sources.length).toBeGreaterThan(1);
  });

  test('comfort costs more than budget', () => {
    const [b, c] = ['budget', 'comfort'].map((s) => dates.styles.find((x) => x.style === s)!.top[0]!.total);
    expect(c!).toBeGreaterThan(b!);
  });

  test('window endpoint re-prices a clicked date with the same offers as the top window', async () => {
    const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
    const res = await request(app.getHttpServer()).get(`/api/search/${id}/window?style=budget&start=${top.start}`).expect(200);
    expect(res.body.window.total).toBe(top.total);
    expect(res.body.estimate).toBeGreaterThan(0);
  });

  test('window endpoint: bad input → 400, a date no trip can start on → 404', async () => {
    await request(app.getHttpServer()).get(`/api/search/${id}/window?start=12-12-2026`).expect(400);
    await request(app.getHttpServer()).get(`/api/search/${id}/window?start=2026-12-05&style=luxury`).expect(400);
    await request(app.getHttpServer()).get(`/api/search/${id}/window?start=2026-12-25`).expect(404);
  });

  test('stream for an unknown search → 404', async () => {
    await request(app.getHttpServer()).get('/api/search/nope/stream').expect(404);
  });
});

describe('results stream — a failing provider', () => {
  test('dates reports "unavailable" and the stream still finishes', async () => {
    const set = createRegistry({}, clock);
    const broken: ProviderSet = {
      ...set,
      hotel: [
        {
          id: 'broken',
          name: 'Broken hotels',
          search: () => Promise.reject(new Error('down')),
          nightlyGroupPrice: () => Promise.reject(new Error('down')),
        },
      ],
    };
    const app = await makeApp(broken);
    try {
      const id = (await request(app.getHttpServer()).post('/api/search').send(briefExample).expect(201)).body.searchId;
      const events = await stream(app, id);
      expect(events.at(-1)!.event).toBe('done');
      // No dates → nothing to build transport or hotels for; every section says so and the stream finishes.
      for (const e of events.slice(0, -1)) expect(e.data).toEqual({ status: 'error', message: 'unavailable' });
      expect(events.map((e) => e.event).sort()).toEqual(['dates', 'done', 'hotels', 'transport']);
    } finally {
      await app.close();
    }
  });
});
