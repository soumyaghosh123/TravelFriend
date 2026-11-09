import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage } from '@nestjs/throttler';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import type { GoogleAuth, GoogleProfile } from '../src/account/google.js';
import type { MailMessage, Mailer } from '../src/account/mailer.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { InMemorySearchStore } from '../src/search/search-store.js';
import { CLOCK, GOOGLE_AUTH, MAILER, SEARCH_STORE } from '../src/tokens.js';

// PLAN §12 step 11: accounts (email link + Google), saved trips, synced "booked" ticks.
let now = new Date('2026-11-08T06:00:00Z');
const clock = () => now;
const mails: MailMessage[] = [];
const mailer: Mailer = { send: async (m) => void mails.push(m) };
let googleProfile: GoogleProfile = {
  sub: 'g-1',
  email: 'asha@example.com',
  emailVerified: true,
  name: 'Asha',
};
const google: GoogleAuth = {
  enabled: true,
  authUrl: ({ state, codeChallenge }) =>
    `https://accounts.google.test/auth?state=${state}&cc=${codeChallenge}`,
  profile: async ({ code }) => {
    if (code !== 'good-code') throw new Error('bad code');
    return googleProfile;
  },
};
class ForgetfulSearchStore extends InMemorySearchStore {
  forgotten = new Set<string>();
  override async get(id: string) {
    return this.forgotten.has(id) ? undefined : super.get(id);
  }
}
const searches = new ForgetfulSearchStore();
const WEB = 'http://localhost:3000';
const briefExample = {
  from: 'KOL',
  to: 'GOA',
  days: 10,
  month: '2026-12',
  hotelTypes: ['3-star'],
  travellers: { adults: 2, childAges: [3, 6] },
};

let app: INestApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  process.env.WEB_ORIGIN = WEB;
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(MAILER)
    .useValue(mailer)
    .overrideProvider(GOOGLE_AUTH)
    .useValue(google)
    .overrideProvider(SEARCH_STORE)
    .useValue(searches)
    // These tests sign in many times from one address; the rate limit has its own test below.
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
  mails.length = 0;
  now = new Date('2026-11-08T06:00:00Z');
});

const linkFrom = (m: MailMessage) => new URL(m.text.match(/https?:\/\/\S+/)![0]);
const cookieOf = (res: request.Response, name: string) =>
  ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith(`${name}=`));

/** Signs in by email link and returns the session cookie header. */
async function signIn(email: string): Promise<string> {
  await http().post('/api/auth/email').set('Origin', WEB).send({ email, next: '/account' }).expect(204);
  const token = linkFrom(mails.at(-1)!).searchParams.get('token')!;
  const res = await http().post('/api/auth/email/verify').set('Origin', WEB).send({ token }).expect(201);
  return cookieOf(res, 'ts_session')!.split(';')[0]!;
}

describe('email link sign-in', () => {
  test('link → Continue → signed in; the link works once; sign out', async () => {
    await http()
      .post('/api/auth/email')
      .set('Origin', WEB)
      .send({ email: '  Ravi@Example.com ', next: '/trip/abc?plan=budget', locale: 'hi' })
      .expect(204);
    expect(mails).toHaveLength(1);
    expect(mails[0]!.to).toBe('ravi@example.com');
    expect(mails[0]!.subject).toContain('साइन-इन');
    const link = linkFrom(mails[0]!);
    // The link opens a page with a Continue button, not the API, so mail scanners can't use it up.
    expect(link.origin + link.pathname).toBe(`${WEB}/signin/verify`);
    expect(link.searchParams.get('next')).toBe('/trip/abc?plan=budget');

    const token = link.searchParams.get('token')!;
    const res = await http().post('/api/auth/email/verify').set('Origin', WEB).send({ token }).expect(201);
    const cookie = cookieOf(res, 'ts_session')!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=2592000/); // 30 days
    const session = cookie.split(';')[0]!;
    expect((await http().get('/api/auth/me').set('Cookie', session)).body).toEqual({
      user: { email: 'ravi@example.com', name: null },
    });

    await http().post('/api/auth/email/verify').set('Origin', WEB).send({ token }).expect(400);
    await http().post('/api/auth/logout').set('Origin', WEB).set('Cookie', session).expect(204);
    expect((await http().get('/api/auth/me').set('Cookie', session)).body).toEqual({ user: null });
  });

  test('links expire after 15 minutes', async () => {
    await http().post('/api/auth/email').set('Origin', WEB).send({ email: 'late@example.com' }).expect(204);
    const token = linkFrom(mails[0]!).searchParams.get('token')!;
    now = new Date(now.getTime() + 16 * 60_000);
    await http().post('/api/auth/email/verify').set('Origin', WEB).send({ token }).expect(400);
  });

  test('bad email → 400; "next" can only be a path on our site', async () => {
    await http().post('/api/auth/email').set('Origin', WEB).send({ email: 'not-an-email' }).expect(400);
    await http()
      .post('/api/auth/email')
      .set('Origin', WEB)
      .send({ email: 'eve@example.com', next: '//evil.example/steal' })
      .expect(204);
    expect(linkFrom(mails[0]!).searchParams.get('next')).toBe('/account');
  });

  test('at most 3 links per address per 15 minutes (the reply never says so)', async () => {
    for (let i = 0; i < 4; i++)
      await http().post('/api/auth/email').set('Origin', WEB).send({ email: 'busy@example.com' }).expect(204);
    expect(mails.filter((m) => m.to === 'busy@example.com')).toHaveLength(3);
  });

  test('per address: at most 5 link requests per 10 minutes, then 429', async () => {
    const limited = (
      await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(MAILER)
        .useValue(mailer)
        .compile()
    ).createNestApplication();
    configureApp(limited, { WEB_ORIGIN: WEB });
    await limited.init();
    try {
      const codes: number[] = [];
      for (let i = 0; i < 6; i++)
        codes.push(
          (
            await request(limited.getHttpServer())
              .post('/api/auth/email')
              .set('Origin', WEB)
              .send({ email: `r${i}@example.com` })
          ).status,
        );
      expect(codes).toEqual([204, 204, 204, 204, 204, 429]);
    } finally {
      await limited.close();
    }
  });

  test('requests from another site are refused', async () => {
    await http()
      .post('/api/auth/email')
      .set('Origin', 'https://evil.example')
      .send({ email: 'x@example.com' })
      .expect(403);
  });
});

describe('Google sign-in', () => {
  test('redirects to Google with state and PKCE; the callback signs in and returns to "next"', async () => {
    const start = await http().get('/api/auth/google?next=/account').expect(302);
    const to = new URL(start.headers.location as string);
    const state = to.searchParams.get('state')!;
    expect(to.searchParams.get('cc')).toBeTruthy();
    const oauth = cookieOf(start, 'ts_oauth')!.split(';')[0]!;

    const cb = await http()
      .get(`/api/auth/google/callback?code=good-code&state=${state}`)
      .set('Cookie', oauth)
      .expect(302);
    expect(cb.headers.location).toBe(`${WEB}/account`);
    const session = cookieOf(cb, 'ts_session')!.split(';')[0]!;
    expect((await http().get('/api/auth/me').set('Cookie', session)).body.user.email).toBe(
      'asha@example.com',
    );
  });

  test('a wrong state or a bad code fails safely', async () => {
    const start = await http().get('/api/auth/google').expect(302);
    const oauth = cookieOf(start, 'ts_oauth')!.split(';')[0]!;
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const wrong = await http()
      .get('/api/auth/google/callback?code=good-code&state=forged')
      .set('Cookie', oauth)
      .expect(302);
    expect(wrong.headers.location).toBe(`${WEB}/account?signin=failed`);
    expect(cookieOf(wrong, 'ts_session')).toBeUndefined();
    const bad = await http()
      .get(`/api/auth/google/callback?code=bad&state=${state}`)
      .set('Cookie', oauth)
      .expect(302);
    expect(bad.headers.location).toBe(`${WEB}/account?signin=failed`);
  });

  test('the same verified email by link and by Google is one account (same saved trips)', async () => {
    const byEmail = await signIn('meera@example.com');
    const searchId = (await http().post('/api/search').send(briefExample).expect(201)).body.searchId;
    await http()
      .post('/api/me/trips')
      .set('Origin', WEB)
      .set('Cookie', byEmail)
      .send({ searchId, style: 'budget', start: '2026-12-08' })
      .expect(201);

    googleProfile = { sub: 'g-meera', email: 'meera@example.com', emailVerified: true, name: 'Meera' };
    const start = await http().get('/api/auth/google').expect(302);
    const state = new URL(start.headers.location as string).searchParams.get('state')!;
    const cb = await http()
      .get(`/api/auth/google/callback?code=good-code&state=${state}`)
      .set('Cookie', cookieOf(start, 'ts_oauth')!.split(';')[0]!);
    const byGoogle = cookieOf(cb, 'ts_session')!.split(';')[0]!;
    expect((await http().get('/api/me/trips').set('Cookie', byGoogle).expect(200)).body).toHaveLength(1);
  });
});

describe('saved trips', () => {
  test('need a session', async () => {
    await http().get('/api/me/trips').expect(401);
  });

  test('save, save again (no duplicate), list, ticks, open, delete; other users see nothing', async () => {
    const me = await signIn('trip@example.com');
    const other = await signIn('other@example.com');
    const searchId = (await http().post('/api/search').send(briefExample).expect(201)).body.searchId;

    const saved = (
      await http()
        .post('/api/me/trips')
        .set('Origin', WEB)
        .set('Cookie', me)
        .send({ searchId, style: 'comfort', start: '2026-12-09', title: 'Goa with the kids' })
        .expect(201)
    ).body;
    expect(saved).toMatchObject({
      searchId,
      style: 'comfort',
      start: '2026-12-09',
      title: 'Goa with the kids',
      inputs: { to: 'GOA' },
    });
    const again = (
      await http()
        .post('/api/me/trips')
        .set('Origin', WEB)
        .set('Cookie', me)
        .send({ searchId, style: 'comfort', start: '2026-12-09' })
        .expect(201)
    ).body;
    expect(again.id).toBe(saved.id);
    expect((await http().get('/api/me/trips').set('Cookie', me)).body).toHaveLength(1);

    await http()
      .put(`/api/me/trips/${saved.id}/booked/onward`)
      .set('Origin', WEB)
      .set('Cookie', me)
      .send({ booked: true })
      .expect(204);
    await http()
      .put(`/api/me/trips/${saved.id}/booked/hotel-calangute-beach`)
      .set('Origin', WEB)
      .set('Cookie', me)
      .send({ booked: true })
      .expect(204);
    await http()
      .put(`/api/me/trips/${saved.id}/booked/onward`)
      .set('Origin', WEB)
      .set('Cookie', me)
      .send({ booked: false })
      .expect(204);
    expect((await http().get(`/api/me/trips/${saved.id}/booked`).set('Cookie', me)).body).toEqual([
      'hotel-calangute-beach',
    ]);

    expect(
      (await http().post(`/api/me/trips/${saved.id}/open`).set('Origin', WEB).set('Cookie', me).expect(201))
        .body,
    ).toEqual({ searchId, style: 'comfort', start: '2026-12-09' });

    // Someone else can't read, tick or delete it.
    expect((await http().get('/api/me/trips').set('Cookie', other)).body).toEqual([]);
    await http().get(`/api/me/trips/${saved.id}/booked`).set('Cookie', other).expect(404);
    await http()
      .put(`/api/me/trips/${saved.id}/booked/onward`)
      .set('Origin', WEB)
      .set('Cookie', other)
      .send({ booked: true })
      .expect(404);
    await http().delete(`/api/me/trips/${saved.id}`).set('Origin', WEB).set('Cookie', other).expect(404);

    await http().delete(`/api/me/trips/${saved.id}`).set('Origin', WEB).set('Cookie', me).expect(204);
    expect((await http().get('/api/me/trips').set('Cookie', me)).body).toEqual([]);
  });

  test('an expired search is run again from the saved inputs; a past month says so', async () => {
    const me = await signIn('again@example.com');
    const searchId = (await http().post('/api/search').send(briefExample).expect(201)).body.searchId;
    const saved = (
      await http()
        .post('/api/me/trips')
        .set('Origin', WEB)
        .set('Cookie', me)
        .send({ searchId, style: 'budget', start: '2026-12-08' })
        .expect(201)
    ).body;
    searches.forgotten.add(searchId);
    const opened = (
      await http().post(`/api/me/trips/${saved.id}/open`).set('Origin', WEB).set('Cookie', me).expect(201)
    ).body;
    expect(opened.searchId).not.toBe(searchId);
    expect((await http().get(`/api/search/${opened.searchId}`).expect(200)).body.input.to).toBe('GOA');

    searches.forgotten.add(opened.searchId);
    now = new Date('2027-02-01T06:00:00Z');
    // Months later the 30-day session has expired too; sign in again (same account).
    await http().post(`/api/me/trips/${saved.id}/open`).set('Origin', WEB).set('Cookie', me).expect(401);
    const later = await signIn('again@example.com');
    await http().post(`/api/me/trips/${saved.id}/open`).set('Origin', WEB).set('Cookie', later).expect(410);
  });

  test('saving needs a known search and valid fields; cross-site changes are refused', async () => {
    const me = await signIn('valid@example.com');
    await http()
      .post('/api/me/trips')
      .set('Origin', WEB)
      .set('Cookie', me)
      .send({ searchId: 'nope', style: 'budget', start: '2026-12-08' })
      .expect(404);
    await http()
      .post('/api/me/trips')
      .set('Origin', WEB)
      .set('Cookie', me)
      .send({ searchId: 'x', style: 'luxury', start: '2026-12-08' })
      .expect(400);
    await http()
      .post('/api/me/trips')
      .set('Origin', 'https://evil.example')
      .set('Cookie', me)
      .send({ searchId: 'x', style: 'budget', start: '2026-12-08' })
      .expect(403);
  });
});
