import type { ValidSearchInput } from '@tripsaver/domain';
import type { Prisma, PriceAlert, PrismaClient, Trip, User } from '@tripsaver/db';
import type {
  AccountStore,
  AccountUser,
  ActiveAlert,
  AlertCheck,
  Locale,
  NewTrip,
  PriceAlertRow,
  SavedTrip,
} from './account-store.js';

const pub = (u: User): AccountUser => ({ id: u.id, email: u.email, name: u.name, googleSub: u.googleSub });
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fromDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

function trip(t: Trip): SavedTrip {
  return {
    id: t.id,
    userId: t.userId!,
    searchId: t.searchId,
    title: t.title,
    style: t.selectedPlan ?? 'budget',
    start: fromDate(t.startDate),
    inputs: t.inputs as unknown as ValidSearchInput,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

const alert = (a: PriceAlert): PriceAlertRow => ({
  id: a.id,
  userId: a.userId,
  tripId: a.tripId,
  threshold: a.thresholdAmount,
  active: a.active,
  lastNotifiedAt: a.lastNotifiedAt?.toISOString() ?? null,
  lastNotifiedAmount: a.lastNotifiedAmount,
  lastCheckedAt: a.lastCheckedAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
});

/** Accounts in PostgreSQL (packages/db). */
export class PrismaAccountStore implements AccountStore {
  constructor(private readonly db: PrismaClient) {}

  async createLoginToken(hash: string, email: string, expiresAt: Date): Promise<void> {
    await this.db.loginToken.create({ data: { id: hash, email, expiresAt } });
  }
  async consumeLoginToken(hash: string, now: Date): Promise<string | null> {
    // One statement, so two clicks on the same link can't both succeed.
    const { count } = await this.db.loginToken.updateMany({
      where: { id: hash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (count !== 1) return null;
    return (await this.db.loginToken.findUnique({ where: { id: hash } }))?.email ?? null;
  }
  async countRecentLoginTokens(email: string, since: Date): Promise<number> {
    return this.db.loginToken.count({ where: { email, createdAt: { gte: since } } });
  }

  async userByEmail(email: string): Promise<AccountUser | null> {
    const u = await this.db.user.findUnique({ where: { email } });
    return u ? pub(u) : null;
  }
  async userByGoogleSub(sub: string): Promise<AccountUser | null> {
    const u = await this.db.user.findUnique({ where: { googleSub: sub } });
    return u ? pub(u) : null;
  }
  async createUser(u: {
    email: string | null;
    name?: string | null;
    googleSub?: string | null;
    emailVerified: boolean;
  }): Promise<AccountUser> {
    return pub(
      await this.db.user.create({
        data: {
          email: u.email,
          name: u.name ?? null,
          googleSub: u.googleSub ?? null,
          emailVerifiedAt: u.emailVerified ? new Date() : null,
        },
      }),
    );
  }
  async linkGoogle(userId: string, sub: string, name: string | null): Promise<AccountUser> {
    const current = await this.db.user.findUniqueOrThrow({ where: { id: userId } });
    return pub(
      await this.db.user.update({
        where: { id: userId },
        data: { googleSub: sub, name: current.name ?? name },
      }),
    );
  }
  async markEmailVerified(userId: string): Promise<void> {
    await this.db.user.updateMany({
      where: { id: userId, emailVerifiedAt: null },
      data: { emailVerifiedAt: new Date() },
    });
  }

  async createSession(hash: string, userId: string, expiresAt: Date): Promise<void> {
    await this.db.session.create({ data: { id: hash, userId, expiresAt } });
  }
  async sessionUser(hash: string, now: Date): Promise<AccountUser | null> {
    const s = await this.db.session.findUnique({ where: { id: hash }, include: { user: true } });
    return s && s.expiresAt > now ? pub(s.user) : null;
  }
  async deleteSession(hash: string): Promise<void> {
    await this.db.session.deleteMany({ where: { id: hash } });
  }

  async listTrips(userId: string): Promise<SavedTrip[]> {
    return (await this.db.trip.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' } })).map(trip);
  }
  async saveTrip(userId: string, t: NewTrip, now: Date): Promise<SavedTrip> {
    const data = { title: t.title, inputs: t.inputs as unknown as Prisma.InputJsonValue, updatedAt: now };
    const existing = await this.db.trip.findFirst({
      where: { userId, searchId: t.searchId, selectedPlan: t.style, startDate: toDate(t.start) },
    });
    const saved = existing
      ? await this.db.trip.update({ where: { id: existing.id }, data })
      : await this.db.trip.create({
          data: { ...data, userId, searchId: t.searchId, selectedPlan: t.style, startDate: toDate(t.start) },
        });
    return trip(saved);
  }
  async getTrip(userId: string, id: string): Promise<SavedTrip | null> {
    const t = await this.db.trip.findFirst({ where: { id, userId } });
    return t ? trip(t) : null;
  }
  async updateTripSearch(userId: string, id: string, searchId: string, now: Date): Promise<void> {
    await this.db.trip.updateMany({ where: { id, userId }, data: { searchId, updatedAt: now } });
  }
  async deleteTrip(userId: string, id: string): Promise<boolean> {
    const { count } = await this.db.trip.deleteMany({ where: { id, userId } });
    return count === 1;
  }
  async bookedItems(tripId: string): Promise<string[]> {
    return (
      await this.db.bookingChecklistItem.findMany({
        where: { tripId, booked: true },
        orderBy: { itemKey: 'asc' },
      })
    ).map((b) => b.itemKey);
  }
  async setBooked(tripId: string, itemKey: string, booked: boolean): Promise<void> {
    await this.db.bookingChecklistItem.upsert({
      where: { tripId_itemKey: { tripId, itemKey } },
      create: { tripId, itemKey, booked },
      update: { booked },
    });
  }

  async upsertAlert(userId: string, tripId: string, threshold: number, now: Date): Promise<PriceAlertRow> {
    const reset = {
      thresholdAmount: threshold,
      active: true,
      lastNotifiedAt: null,
      lastNotifiedAmount: null,
    };
    return alert(
      await this.db.priceAlert.upsert({
        where: { tripId },
        create: { userId, tripId, createdAt: now, ...reset },
        update: reset,
      }),
    );
  }
  async listAlerts(userId: string): Promise<PriceAlertRow[]> {
    return (await this.db.priceAlert.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })).map(
      alert,
    );
  }
  async getAlert(userId: string, id: string): Promise<PriceAlertRow | null> {
    const a = await this.db.priceAlert.findFirst({ where: { id, userId } });
    return a ? alert(a) : null;
  }
  async setAlertActive(userId: string, id: string, active: boolean): Promise<boolean> {
    const { count } = await this.db.priceAlert.updateMany({ where: { id, userId }, data: { active } });
    return count === 1;
  }
  async deleteAlert(userId: string, id: string): Promise<boolean> {
    const { count } = await this.db.priceAlert.deleteMany({ where: { id, userId } });
    return count === 1;
  }
  async activeAlerts(): Promise<ActiveAlert[]> {
    const rows = await this.db.priceAlert.findMany({
      where: { active: true },
      include: { trip: true, user: true },
    });
    return rows.map((r) => ({
      alert: alert(r),
      trip: trip(r.trip),
      user: { ...pub(r.user), locale: r.user.locale },
    }));
  }
  async recordAlertCheck(id: string, r: AlertCheck): Promise<void> {
    await this.db.priceAlert.updateMany({
      where: { id },
      data: {
        lastCheckedAt: r.checkedAt,
        ...(r.notifiedAmount !== undefined
          ? { lastNotifiedAmount: r.notifiedAmount, lastNotifiedAt: r.checkedAt }
          : {}),
        ...(r.deactivate ? { active: false } : {}),
      },
    });
  }
  async setUserLocale(userId: string, locale: Locale): Promise<void> {
    await this.db.user.update({ where: { id: userId }, data: { locale } });
  }
}
