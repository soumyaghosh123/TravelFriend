import { randomUUID } from 'node:crypto';
import type { ValidSearchInput } from '@tripsaver/domain';

export interface AccountUser {
  id: string;
  email: string | null;
  name: string | null;
  googleSub: string | null;
}

export interface SavedTrip {
  id: string;
  userId: string;
  searchId: string | null;
  title: string | null;
  style: string;
  /** Start date, YYYY-MM-DD. */
  start: string;
  inputs: ValidSearchInput;
  createdAt: string;
  updatedAt: string;
}

export type NewTrip = Pick<SavedTrip, 'searchId' | 'title' | 'style' | 'start' | 'inputs'>;

export type Locale = 'en' | 'hi' | 'bn';

/** "Tell me when this trip drops below ₹X" (spec 2026-11-10-price-alerts). Amounts are integer rupees. */
export interface PriceAlertRow {
  id: string;
  userId: string;
  tripId: string;
  threshold: number;
  active: boolean;
  lastNotifiedAt: string | null;
  lastNotifiedAmount: number | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

/** What the daily check needs for one alert. */
export interface ActiveAlert {
  alert: PriceAlertRow;
  trip: SavedTrip;
  user: AccountUser & { locale: string };
}

export interface AlertCheck {
  checkedAt: Date;
  /** Set when an email was sent for this total. */
  notifiedAmount?: number;
  /** Switch the alert off (trip date passed or the saved search can't be run any more). */
  deactivate?: boolean;
}

/**
 * Users, sessions, sign-in tokens and saved trips (PLAN §12 step 11). Token and session ids are the
 * SHA-256 of the secret the browser holds, so the store never sees a usable secret.
 */
export interface AccountStore {
  // Sign-in tokens (email links)
  createLoginToken(hash: string, email: string, expiresAt: Date): Promise<void>;
  /** Marks the token used and returns its email, or null if it is unknown, used or expired. */
  consumeLoginToken(hash: string, now: Date): Promise<string | null>;
  countRecentLoginTokens(email: string, since: Date): Promise<number>;

  // Users
  userByEmail(email: string): Promise<AccountUser | null>;
  userByGoogleSub(sub: string): Promise<AccountUser | null>;
  createUser(u: {
    email: string | null;
    name?: string | null;
    googleSub?: string | null;
    emailVerified: boolean;
  }): Promise<AccountUser>;
  linkGoogle(userId: string, sub: string, name: string | null): Promise<AccountUser>;
  markEmailVerified(userId: string): Promise<void>;

  // Sessions
  createSession(hash: string, userId: string, expiresAt: Date): Promise<void>;
  sessionUser(hash: string, now: Date): Promise<AccountUser | null>;
  deleteSession(hash: string): Promise<void>;

  // Saved trips
  listTrips(userId: string): Promise<SavedTrip[]>;
  /** Same search, plan and start date → the existing trip (updated), not a duplicate. */
  saveTrip(userId: string, t: NewTrip, now: Date): Promise<SavedTrip>;
  getTrip(userId: string, id: string): Promise<SavedTrip | null>;
  updateTripSearch(userId: string, id: string, searchId: string, now: Date): Promise<void>;
  deleteTrip(userId: string, id: string): Promise<boolean>;
  bookedItems(tripId: string): Promise<string[]>;
  setBooked(tripId: string, itemKey: string, booked: boolean): Promise<void>;

  // Price alerts (one per saved trip; deleting the trip or the user deletes it)
  /** Creates the trip's alert, or updates it: new threshold, switched on, notification history cleared. */
  upsertAlert(userId: string, tripId: string, threshold: number, now: Date): Promise<PriceAlertRow>;
  listAlerts(userId: string): Promise<PriceAlertRow[]>;
  getAlert(userId: string, id: string): Promise<PriceAlertRow | null>;
  setAlertActive(userId: string, id: string, active: boolean): Promise<boolean>;
  deleteAlert(userId: string, id: string): Promise<boolean>;
  activeAlerts(): Promise<ActiveAlert[]>;
  recordAlertCheck(id: string, r: AlertCheck): Promise<void>;
  /** The language emails are written in. */
  setUserLocale(userId: string, locale: Locale): Promise<void>;
}

/** Process-local store for tests and running without a database. */
export class InMemoryAccountStore implements AccountStore {
  private tokens = new Map<
    string,
    { email: string; createdAt: Date; expiresAt: Date; usedAt: Date | null }
  >();
  private users = new Map<string, AccountUser & { emailVerified: boolean; locale?: string }>();
  private sessions = new Map<string, { userId: string; expiresAt: Date }>();
  private trips = new Map<string, SavedTrip>();
  private booked = new Map<string, Set<string>>();
  private alerts = new Map<string, PriceAlertRow>();

  async createLoginToken(hash: string, email: string, expiresAt: Date): Promise<void> {
    this.tokens.set(hash, { email, createdAt: new Date(), expiresAt, usedAt: null });
  }
  async consumeLoginToken(hash: string, now: Date): Promise<string | null> {
    const t = this.tokens.get(hash);
    if (!t || t.usedAt || t.expiresAt <= now) return null;
    t.usedAt = now;
    return t.email;
  }
  async countRecentLoginTokens(email: string, since: Date): Promise<number> {
    return [...this.tokens.values()].filter((t) => t.email === email && t.createdAt >= since).length;
  }

  private pub(u: AccountUser): AccountUser {
    return { id: u.id, email: u.email, name: u.name, googleSub: u.googleSub };
  }
  async userByEmail(email: string): Promise<AccountUser | null> {
    const u = [...this.users.values()].find((x) => x.email === email);
    return u ? this.pub(u) : null;
  }
  async userByGoogleSub(sub: string): Promise<AccountUser | null> {
    const u = [...this.users.values()].find((x) => x.googleSub === sub);
    return u ? this.pub(u) : null;
  }
  async createUser(u: {
    email: string | null;
    name?: string | null;
    googleSub?: string | null;
    emailVerified: boolean;
  }): Promise<AccountUser> {
    const user = {
      id: randomUUID(),
      email: u.email,
      name: u.name ?? null,
      googleSub: u.googleSub ?? null,
      emailVerified: u.emailVerified,
    };
    this.users.set(user.id, user);
    return this.pub(user);
  }
  async linkGoogle(userId: string, sub: string, name: string | null): Promise<AccountUser> {
    const u = this.users.get(userId)!;
    u.googleSub = sub;
    u.name = u.name ?? name;
    return this.pub(u);
  }
  async markEmailVerified(userId: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.emailVerified = true;
  }

  async createSession(hash: string, userId: string, expiresAt: Date): Promise<void> {
    this.sessions.set(hash, { userId, expiresAt });
  }
  async sessionUser(hash: string, now: Date): Promise<AccountUser | null> {
    const s = this.sessions.get(hash);
    if (!s || s.expiresAt <= now) return null;
    const u = this.users.get(s.userId);
    return u ? this.pub(u) : null;
  }
  async deleteSession(hash: string): Promise<void> {
    this.sessions.delete(hash);
  }

  async listTrips(userId: string): Promise<SavedTrip[]> {
    return [...this.trips.values()]
      .filter((t) => t.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  async saveTrip(userId: string, t: NewTrip, now: Date): Promise<SavedTrip> {
    const existing = [...this.trips.values()].find(
      (x) => x.userId === userId && x.searchId === t.searchId && x.style === t.style && x.start === t.start,
    );
    const trip: SavedTrip = existing
      ? { ...existing, ...t, updatedAt: now.toISOString() }
      : { id: randomUUID(), userId, ...t, createdAt: now.toISOString(), updatedAt: now.toISOString() };
    this.trips.set(trip.id, trip);
    return trip;
  }
  async getTrip(userId: string, id: string): Promise<SavedTrip | null> {
    const t = this.trips.get(id);
    return t && t.userId === userId ? t : null;
  }
  async updateTripSearch(userId: string, id: string, searchId: string, now: Date): Promise<void> {
    const t = await this.getTrip(userId, id);
    if (t) this.trips.set(id, { ...t, searchId, updatedAt: now.toISOString() });
  }
  async deleteTrip(userId: string, id: string): Promise<boolean> {
    const t = await this.getTrip(userId, id);
    if (!t) return false;
    this.trips.delete(id);
    this.booked.delete(id);
    for (const a of this.alerts.values()) if (a.tripId === id) this.alerts.delete(a.id);
    return true;
  }
  async bookedItems(tripId: string): Promise<string[]> {
    return [...(this.booked.get(tripId) ?? [])].sort();
  }
  async setBooked(tripId: string, itemKey: string, booked: boolean): Promise<void> {
    const s = this.booked.get(tripId) ?? new Set<string>();
    if (booked) s.add(itemKey);
    else s.delete(itemKey);
    this.booked.set(tripId, s);
  }

  async upsertAlert(userId: string, tripId: string, threshold: number, now: Date): Promise<PriceAlertRow> {
    const existing = [...this.alerts.values()].find((a) => a.tripId === tripId);
    const row: PriceAlertRow = {
      id: existing?.id ?? randomUUID(),
      userId,
      tripId,
      threshold,
      active: true,
      lastNotifiedAt: null,
      lastNotifiedAmount: null,
      lastCheckedAt: existing?.lastCheckedAt ?? null,
      createdAt: existing?.createdAt ?? now.toISOString(),
    };
    this.alerts.set(row.id, row);
    return { ...row };
  }
  async listAlerts(userId: string): Promise<PriceAlertRow[]> {
    return [...this.alerts.values()].filter((a) => a.userId === userId).map((a) => ({ ...a }));
  }
  async getAlert(userId: string, id: string): Promise<PriceAlertRow | null> {
    const a = this.alerts.get(id);
    return a && a.userId === userId ? { ...a } : null;
  }
  async setAlertActive(userId: string, id: string, active: boolean): Promise<boolean> {
    const a = this.alerts.get(id);
    if (!a || a.userId !== userId) return false;
    a.active = active;
    return true;
  }
  async deleteAlert(userId: string, id: string): Promise<boolean> {
    const a = this.alerts.get(id);
    if (!a || a.userId !== userId) return false;
    return this.alerts.delete(id);
  }
  async activeAlerts(): Promise<ActiveAlert[]> {
    return [...this.alerts.values()].flatMap((a) => {
      const trip = this.trips.get(a.tripId);
      const user = this.users.get(a.userId);
      if (!a.active || !trip || !user) return [];
      return [{ alert: { ...a }, trip, user: { ...this.pub(user), locale: user.locale ?? 'en' } }];
    });
  }
  async recordAlertCheck(id: string, r: AlertCheck): Promise<void> {
    const a = this.alerts.get(id);
    if (!a) return;
    a.lastCheckedAt = r.checkedAt.toISOString();
    if (r.notifiedAmount !== undefined) {
      a.lastNotifiedAmount = r.notifiedAmount;
      a.lastNotifiedAt = r.checkedAt.toISOString();
    }
    if (r.deactivate) a.active = false;
  }
  async setUserLocale(userId: string, locale: Locale): Promise<void> {
    const u = this.users.get(userId);
    if (u) u.locale = locale;
  }
}
