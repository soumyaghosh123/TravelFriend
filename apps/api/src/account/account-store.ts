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
}

/** Process-local store for tests and running without a database. */
export class InMemoryAccountStore implements AccountStore {
  private tokens = new Map<
    string,
    { email: string; createdAt: Date; expiresAt: Date; usedAt: Date | null }
  >();
  private users = new Map<string, AccountUser & { emailVerified: boolean }>();
  private sessions = new Map<string, { userId: string; expiresAt: Date }>();
  private trips = new Map<string, SavedTrip>();
  private booked = new Map<string, Set<string>>();

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
}
