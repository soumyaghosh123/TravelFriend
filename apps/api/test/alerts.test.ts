import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { AccountStore } from '../src/account/account-store.js';
import type { MailMessage, Mailer } from '../src/account/mailer.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { ACCOUNT_STORE, CLOCK, MAILER, TRIP_PRICER } from '../src/tokens.js';
import { priceAlertSchedule } from '../src/worker/price-alert-scheduler.js';
import type { PricedTrip, TripPricer } from '../src/worker/trip-pricer.js';

// Spec 2026-11-10-price-alerts: /api/me/alerts, the dev trigger and the daily schedule.
const now = new Date('2026-11-10T06:00:00Z');
const mails: MailMessage[] = [];
const mailer: Mailer = { send: async (m) => void mails.push(m) };
let priced: PricedTrip = {
  kind: 'ok',
  total: 40000,
  perPerson: 10000,
  start: '2026-12-06',
  end: '2026-12-15',
  destination: 'Goa',
};
const pricer: TripPricer = { price: async () => priced };
const WEB = 'http://localhost:3000';

let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  process.env.WEB_ORIGIN = WEB;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => now)
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(TRIP_PRICER)
    .useValue(pricer)
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: async () => ({ totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }),
    })
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app, { WEB_ORIGIN: WEB });
  await app.init();
});
afterAll(async () => app.close());
beforeEach(() => {
  priced = {
    kind: 'ok',
    total: 40000,
    perPerson: 10000,
    start: '2026-12-06',
    end: '2026-12-15',
    destination: 'Goa',
  };
});

const linkFrom = (m: MailMessage) => new URL(m.text.match(/https?:\/\/\S+/)![0]);
async function signIn(email: string): Promise<string> {
  await http().post('/api/auth/email').set('Origin', WEB).send({ email }).expect(204);
  const token = linkFrom(mails.at(-1)!).searchParams.get('token')!;
  const res = await http().post('/api/auth/email/verify').set('Origin', WEB).send({ token }).expect(201);
  const set = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  return set.find((c) => c.startsWith('ts_session='))!.split(';')[0]!;
}
/** A signed-in user with one saved trip. */
async function userWithTrip(email: string): Promise<{ cookie: string; tripId: string }> {
  const cookie = await signIn(email);
  const search = await http()
    .post('/api/search')
    .set('Origin', WEB)
    .send({
      from: 'KOL',
      to: 'GOA',
      days: 10,
      month: '2026-12',
      hotelTypes: ['3-star'],
      travellers: { adults: 2, childAges: [3, 6] },
    });
  expect(search.status).toBe(201);
  const trip = await http()
    .post('/api/me/trips')
    .set('Origin', WEB)
    .set('Cookie', cookie)
    .send({ searchId: search.body.searchId, style: 'budget', start: '2026-12-06', title: 'Goa' })
    .expect(201);
  return { cookie, tripId: trip.body.id };
}
const post = (cookie: string, body: object) =>
  http().post('/api/me/alerts').set('Origin', WEB).set('Cookie', cookie).send(body);

describe('/api/me/alerts', () => {
  test('signed out: 401 everywhere', async () => {
    await http().get('/api/me/alerts').expect(401);
    await http().post('/api/me/alerts').set('Origin', WEB).send({ tripId: 'x', threshold: 1 }).expect(401);
    await http().patch('/api/me/alerts/x').set('Origin', WEB).send({ active: false }).expect(401);
    await http().delete('/api/me/alerts/x').set('Origin', WEB).expect(401);
  });

  test("set an alert below today's total; the language is remembered for emails", async () => {
    const { cookie, tripId } = await userWithTrip('set@example.com');
    const res = await post(cookie, { tripId, threshold: 38000, locale: 'hi' }).expect(201);
    expect(res.body).toMatchObject({
      tripId,
      threshold: 38000,
      active: true,
      currentTotal: 40000,
      tripTitle: 'Goa',
    });
    const store = app.get<AccountStore>(ACCOUNT_STORE);
    const [row] = (await store.activeAlerts()).filter((a) => a.trip.id === tripId);
    expect(row!.user.locale).toBe('hi');
  });

  test.each([40000, 45000, 0, -5, 38000.5, 'abc'])(
    'threshold %s → 400 alert.threshold',
    async (threshold) => {
      const { cookie, tripId } = await userWithTrip(`bad-${String(threshold)}@example.com`);
      const res = await post(cookie, { tripId, threshold }).expect(400);
      expect(res.body.message).toBe('alert.threshold');
    },
  );

  test("someone else's trip, or no such trip → 404", async () => {
    const a = await userWithTrip('owner@example.com');
    const b = await signIn('other@example.com');
    await post(b, { tripId: a.tripId, threshold: 38000 }).expect(404);
    await post(b, { tripId: 'nope', threshold: 38000 }).expect(404);
  });

  test.each(['stale', 'unavailable'] as const)(
    'trip that cannot be priced (%s) → 400 alert.unavailable',
    async (kind) => {
      const { cookie, tripId } = await userWithTrip(`unpriced-${kind}@example.com`);
      priced = { kind };
      const res = await post(cookie, { tripId, threshold: 38000 }).expect(400);
      expect(res.body.message).toBe('alert.unavailable');
    },
  );

  test('list only mine; pause; delete', async () => {
    const { cookie, tripId } = await userWithTrip('list@example.com');
    const other = await userWithTrip('list-other@example.com');
    const { body: mine } = await post(cookie, { tripId, threshold: 38000 }).expect(201);
    await post(other.cookie, { tripId: other.tripId, threshold: 39000 }).expect(201);

    const list = await http().get('/api/me/alerts').set('Cookie', cookie).expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      id: mine.id,
      tripId,
      tripTitle: 'Goa',
      threshold: 38000,
      active: true,
    });

    await http()
      .patch(`/api/me/alerts/${mine.id}`)
      .set('Origin', WEB)
      .set('Cookie', other.cookie)
      .send({ active: false })
      .expect(404);
    await http()
      .patch(`/api/me/alerts/${mine.id}`)
      .set('Origin', WEB)
      .set('Cookie', cookie)
      .send({ active: false })
      .expect(204);
    expect((await http().get('/api/me/alerts').set('Cookie', cookie)).body[0].active).toBe(false);

    await http().delete(`/api/me/alerts/${mine.id}`).set('Origin', WEB).set('Cookie', cookie).expect(204);
    await http().delete(`/api/me/alerts/${mine.id}`).set('Origin', WEB).set('Cookie', cookie).expect(404);
  });

  test('changes from another site are refused', async () => {
    const { cookie, tripId } = await userWithTrip('csrf@example.com');
    await http()
      .post('/api/me/alerts')
      .set('Origin', 'https://evil.example')
      .set('Cookie', cookie)
      .send({ tripId, threshold: 38000 })
      .expect(403);
  });
});

describe('dev trigger and schedule', () => {
  test('POST /api/dev/alerts/run runs the check (not in production)', async () => {
    const { cookie, tripId } = await userWithTrip('dev@example.com');
    await post(cookie, { tripId, threshold: 38000 }).expect(201);
    priced = {
      kind: 'ok',
      total: 36000,
      perPerson: 9000,
      start: '2026-12-06',
      end: '2026-12-15',
      destination: 'Goa',
    };
    mails.length = 0;
    const res = await http().post('/api/dev/alerts/run').set('Origin', WEB).expect(201);
    expect(res.body).toMatchObject({ notified: expect.any(Number), checked: expect.any(Number), failed: 0 });
    expect(mails.some((m) => m.to === 'dev@example.com' && m.subject.includes('₹36,000'))).toBe(true);

    const env = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    await http().post('/api/dev/alerts/run').set('Origin', WEB).expect(404);
    process.env.NODE_ENV = env;
  });

  test('daily at 07:00 India time', () => {
    expect(priceAlertSchedule).toEqual({ pattern: '0 7 * * *', tz: 'Asia/Kolkata' });
  });
});
