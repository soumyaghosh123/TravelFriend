import { randomUUID } from 'node:crypto';
import { makeSearchInputSchema } from '@tripsaver/domain';
import { PrismaClient } from '@tripsaver/db';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { InMemoryAccountStore, type AccountStore } from '../src/account/account-store.js';
import { PrismaAccountStore } from '../src/account/prisma-account-store.js';

// The same contract for both stores. The Prisma one runs against the docker-compose PostgreSQL
// (pnpm db:up + pnpm db:migrate) and is skipped when it isn't reachable.
const url =
  process.env.DATABASE_TEST_URL ?? 'postgresql://tripsaver:tripsaver@localhost:5432/tripsaver?schema=public';
let prisma: PrismaClient | null = null;
const createdEmails: string[] = [];

beforeAll(async () => {
  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$queryRaw`SELECT 1 FROM "Session" LIMIT 1`;
    prisma = client;
  } catch {
    await client.$disconnect();
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.loginToken.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
    await prisma.$disconnect();
  }
});

const inputs = makeSearchInputSchema('2026-11-08').parse({
  from: 'KOL',
  to: 'GOA',
  days: 10,
  month: '2026-12',
  hotelTypes: ['3-star'],
  travellers: { adults: 2, childAges: [3, 6] },
});
const now = new Date('2026-11-08T06:00:00Z');
const later = (min: number) => new Date(now.getTime() + min * 60_000);
const email = () => {
  const e = `store-${randomUUID()}@example.com`;
  createdEmails.push(e);
  return e;
};

const stores: [string, () => AccountStore | null][] = [
  ['in-memory', () => new InMemoryAccountStore()],
  ['prisma', () => (prisma ? new PrismaAccountStore(prisma) : null)],
];

describe.each(stores)('AccountStore contract: %s', (_name, make) => {
  test('login tokens: once, before expiry; recent count', async (ctx) => {
    const s = make();
    if (!s) return ctx.skip();
    const e = email();
    const hash = randomUUID();
    await s.createLoginToken(hash, e, later(15));
    expect(await s.countRecentLoginTokens(e, later(-1))).toBe(1);
    expect(await s.consumeLoginToken(hash, later(16))).toBeNull(); // expired
    expect(await s.consumeLoginToken(hash, now)).toBe(e);
    expect(await s.consumeLoginToken(hash, now)).toBeNull(); // used
    expect(await s.consumeLoginToken(randomUUID(), now)).toBeNull();
  });

  test('users, Google linking and sessions', async (ctx) => {
    const s = make();
    if (!s) return ctx.skip();
    const e = email();
    const u = await s.createUser({ email: e, emailVerified: true });
    expect(await s.userByEmail(e)).toEqual(u);
    const sub = `g-${randomUUID()}`;
    const linked = await s.linkGoogle(u.id, sub, 'Asha');
    expect(linked).toMatchObject({ id: u.id, googleSub: sub, name: 'Asha' });
    expect((await s.userByGoogleSub(sub))?.id).toBe(u.id);

    const sess = randomUUID();
    await s.createSession(sess, u.id, later(60));
    expect((await s.sessionUser(sess, now))?.id).toBe(u.id);
    expect(await s.sessionUser(sess, later(61))).toBeNull();
    await s.deleteSession(sess);
    expect(await s.sessionUser(sess, now)).toBeNull();
  });

  test('trips: save is idempotent per search+plan+start, owner only, booked ticks', async (ctx) => {
    const s = make();
    if (!s) return ctx.skip();
    const me = await s.createUser({ email: email(), emailVerified: true });
    const other = await s.createUser({ email: email(), emailVerified: true });
    const t = { searchId: randomUUID(), title: 'Goa', style: 'budget', start: '2026-12-08', inputs };
    const a = await s.saveTrip(me.id, t, now);
    const b = await s.saveTrip(me.id, { ...t, title: 'Goa with kids' }, later(1));
    expect(b.id).toBe(a.id);
    expect(b).toMatchObject({
      title: 'Goa with kids',
      style: 'budget',
      start: '2026-12-08',
      inputs: { to: 'GOA' },
    });
    await s.saveTrip(me.id, { ...t, style: 'comfort' }, later(2));
    expect((await s.listTrips(me.id)).map((x) => x.style)).toEqual(['comfort', 'budget']); // newest first
    expect(await s.getTrip(other.id, a.id)).toBeNull();
    expect(await s.deleteTrip(other.id, a.id)).toBe(false);

    await s.setBooked(a.id, 'onward', true);
    await s.setBooked(a.id, 'return', true);
    await s.setBooked(a.id, 'onward', false);
    expect(await s.bookedItems(a.id)).toEqual(['return']);

    await s.updateTripSearch(me.id, a.id, 'new-search', later(3));
    expect((await s.getTrip(me.id, a.id))?.searchId).toBe('new-search');
    expect(await s.deleteTrip(me.id, a.id)).toBe(true);
    expect(await s.getTrip(me.id, a.id)).toBeNull();
  });
});
