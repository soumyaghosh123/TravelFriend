import 'reflect-metadata';
import { makeSearchInputSchema } from '@tripsaver/domain';
import { createRegistry, fixedClock, type PlanCostView } from '@tripsaver/providers';
import { beforeEach, describe, expect, test } from 'vitest';
import { InMemoryAccountStore, type SavedTrip } from '../src/account/account-store.js';
import type { MailMessage, Mailer } from '../src/account/mailer.js';
import { CostService } from '../src/results/cost.service.js';
import { DatesService } from '../src/results/dates.service.js';
import { PriceAlertChecker } from '../src/worker/price-alert-checker.js';
import { LiveTripPricer, type PricedTrip, type TripPricer } from '../src/worker/trip-pricer.js';

const WEB = 'http://localhost:3000';
const inputs = makeSearchInputSchema('2026-11-08').parse({
  from: 'KOL',
  to: 'GOA',
  days: 10,
  month: '2026-12',
  hotelTypes: ['3-star'],
  travellers: { adults: 2, childAges: [3, 6] },
});
const at = (iso: string) => new Date(iso);
const day1 = at('2026-11-10T01:30:00Z'); // 07:00 in India
const day2 = at('2026-11-11T01:30:00Z');

/** Scripted results per trip id, one per run. */
class FakePricer implements TripPricer {
  script = new Map<string, (PricedTrip | Error)[]>();
  async price(trip: SavedTrip): Promise<PricedTrip> {
    const next = this.script.get(trip.id)?.shift();
    if (!next) throw new Error('no scripted price');
    if (next instanceof Error) throw next;
    return next;
  }
}
const ok = (total: number): PricedTrip => ({
  kind: 'ok',
  total,
  perPerson: Math.round(total / 4),
  start: '2026-12-06',
  end: '2026-12-15',
  destination: 'Goa',
});

let store: InMemoryAccountStore;
let pricer: FakePricer;
let mails: MailMessage[];
let failMail: boolean;
let checker: PriceAlertChecker;
const mailer: Mailer = {
  send: async (m) => {
    if (failMail) throw new Error('SMTP down');
    mails.push(m);
  },
};

async function alertFor(threshold: number, start = '2026-12-06', email = 'asha@example.com') {
  const user = await store.createUser({ email, emailVerified: true });
  const trip = await store.saveTrip(
    user.id,
    { searchId: `s-${email}`, style: 'budget', start, title: 'Goa', inputs },
    day1,
  );
  const alert = await store.upsertAlert(user.id, trip.id, threshold, day1);
  return { user, trip, alert };
}

beforeEach(() => {
  store = new InMemoryAccountStore();
  pricer = new FakePricer();
  mails = [];
  failMail = false;
  checker = new PriceAlertChecker(store, pricer, mailer, WEB);
});

describe('PriceAlertChecker.runOnce (spec 2026-11-10-price-alerts)', () => {
  test('notifies once below the threshold, with amounts, approx., time and both links', async () => {
    const { user, trip, alert } = await alertFor(40000);
    pricer.script.set(trip.id, [ok(38400)]);
    expect(await checker.runOnce(day1)).toEqual({ checked: 1, notified: 1, expired: 0, failed: 0 });
    expect(mails).toHaveLength(1);
    const m = mails[0]!;
    expect(m.to).toBe('asha@example.com');
    expect(m.subject).toContain('₹38,400');
    for (const s of [
      '₹40,000',
      '₹9,600',
      'approx.',
      '07:00',
      `${WEB}/account?open=${trip.id}`,
      `${WEB}/account`,
    ])
      expect(m.text).toContain(s);
    expect((await store.getAlert(user.id, alert.id))!.lastNotifiedAmount).toBe(38400);
  });

  test('no repeat for the same total; a further drop notifies again', async () => {
    const { trip } = await alertFor(40000);
    pricer.script.set(trip.id, [ok(38400), ok(38400), ok(37000)]);
    await checker.runOnce(day1);
    await checker.runOnce(day2);
    expect(mails).toHaveLength(1);
    await checker.runOnce(at('2026-11-12T01:30:00Z'));
    expect(mails).toHaveLength(2);
    expect(mails[1]!.subject).toContain('₹37,000');
  });

  test('expire when the start date has passed: no email, switched off', async () => {
    const { user, trip, alert } = await alertFor(40000, '2026-11-09');
    pricer.script.set(trip.id, [ok(30000)]);
    expect(await checker.runOnce(day1)).toMatchObject({ expired: 1, notified: 0 });
    expect(mails).toEqual([]);
    expect((await store.getAlert(user.id, alert.id))!.active).toBe(false);
  });

  test('expire when the saved inputs are stale (month passed)', async () => {
    const { user, trip, alert } = await alertFor(40000);
    pricer.script.set(trip.id, [{ kind: 'stale' }]);
    expect(await checker.runOnce(day1)).toMatchObject({ expired: 1 });
    expect((await store.getAlert(user.id, alert.id))!.active).toBe(false);
  });

  test('a date that can no longer start a trip is skipped and stays on', async () => {
    const { user, trip, alert } = await alertFor(40000);
    pricer.script.set(trip.id, [{ kind: 'unavailable' }]);
    expect(await checker.runOnce(day1)).toMatchObject({ checked: 1, notified: 0, expired: 0 });
    const a = (await store.getAlert(user.id, alert.id))!;
    expect(a.active).toBe(true);
    expect(a.lastCheckedAt).toBe(day1.toISOString());
  });

  test('one failing trip is skipped; the others still run', async () => {
    const a = await alertFor(40000, '2026-12-06', 'a@example.com');
    const b = await alertFor(40000, '2026-12-06', 'b@example.com');
    pricer.script.set(a.trip.id, [new Error('provider down')]);
    pricer.script.set(b.trip.id, [ok(38400)]);
    expect(await checker.runOnce(day1)).toMatchObject({ failed: 1, notified: 1 });
    expect(mails.map((m) => m.to)).toEqual(['b@example.com']);
  });

  test('overlapping runs share one run: no duplicate emails', async () => {
    const { trip } = await alertFor(40000);
    pricer.script.set(trip.id, [ok(38400), ok(38400)]);
    const [a, b] = await Promise.all([checker.runOnce(day1), checker.runOnce(day1)]);
    expect(a).toEqual(b);
    expect(mails).toHaveLength(1);
  });

  test('a failed email is not recorded, so the next run emails again', async () => {
    const { user, trip, alert } = await alertFor(40000);
    pricer.script.set(trip.id, [ok(38400), ok(38400)]);
    failMail = true;
    expect(await checker.runOnce(day1)).toMatchObject({ failed: 1, notified: 0 });
    expect((await store.getAlert(user.id, alert.id))!.lastNotifiedAmount).toBeNull();
    failMail = false;
    expect(await checker.runOnce(day2)).toMatchObject({ notified: 1 });
  });

  test("email in the user's language (Hindi), amounts still in rupees", async () => {
    const { user, trip } = await alertFor(40000);
    await store.setUserLocale(user.id, 'hi');
    pricer.script.set(trip.id, [ok(38400)]);
    await checker.runOnce(day1);
    expect(mails[0]!.subject).toMatch(/[ऀ-ॿ]/);
    expect(mails[0]!.subject).toContain('₹38,400');
  });
});

describe('LiveTripPricer with the mock providers', () => {
  test('total equals the Total & book figure for the same plan and start date', async () => {
    const clock = fixedClock('2026-11-10T01:30:00Z');
    const set = createRegistry({}, clock);
    const dates = new DatesService(set, clock);
    const cost = new CostService(set, clock);
    const detail = await dates.window('ref', inputs, 'budget', '2026-12-06');
    expect(detail).not.toBeNull();
    const view = (await cost.plan(inputs, 'budget', detail!.window)) as Extract<
      PlanCostView,
      { available: true }
    >;
    const trip = { id: 't1', start: '2026-12-06', style: 'budget', inputs } as SavedTrip;
    const priced = await new LiveTripPricer(dates, cost, set).price(trip, clock());
    expect(priced).toMatchObject({
      kind: 'ok',
      total: view.cost.total,
      destination: 'Goa',
      start: '2026-12-06',
    });
  });

  test("pricing alerts leaves the results pages' window cache alone", async () => {
    const clock = fixedClock('2026-11-10T01:30:00Z');
    const set = createRegistry({}, clock);
    const dates = new DatesService(set, clock);
    const size = () => (dates as unknown as { cache: Map<string, unknown> }).cache.size;
    const trip = { id: 't1', start: '2026-12-06', style: 'budget', inputs } as SavedTrip;
    await new LiveTripPricer(dates, new CostService(set, clock), set).price(trip, clock());
    expect(size()).toBe(0);
  });

  test('a saved month that has passed is stale', async () => {
    const clock = fixedClock('2027-01-10T01:30:00Z');
    const set = createRegistry({}, clock);
    const trip = { id: 't1', start: '2026-12-06', style: 'budget', inputs } as SavedTrip;
    const pricer = new LiveTripPricer(new DatesService(set, clock), new CostService(set, clock), set);
    expect(await pricer.price(trip, clock())).toEqual({ kind: 'stale' });
  });
});
