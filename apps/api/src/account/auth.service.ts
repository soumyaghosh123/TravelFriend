import { Inject, Injectable } from '@nestjs/common';
import type { Clock } from '@tripsaver/providers';
import { ACCOUNT_STORE, CLOCK, GOOGLE_AUTH, MAILER } from '../tokens.js';
import type { AccountStore, AccountUser } from './account-store.js';
import type { GoogleAuth } from './google.js';
import type { Mailer } from './mailer.js';
import { hashSecret, newSecret } from './secrets.js';

export const SESSION_COOKIE = 'ts_session';
export const OAUTH_COOKIE = 'ts_oauth';
export const SESSION_DAYS = 30;
const LINK_MINUTES = 15;
/** Email links per address per 15 minutes, on top of the per-IP rate limit. */
const MAX_LINKS = 3;

const SUBJECT: Record<string, string> = {
  en: 'Your TripSaver sign-in link',
  hi: 'आपका TripSaver साइन-इन लिंक',
  bn: 'আপনার TripSaver সাইন-ইন লিঙ্ক',
};
const BODY: Record<string, (link: string) => string> = {
  en: (l) =>
    `Open this link to sign in to TripSaver:\n\n${l}\n\nIt works once, for ${LINK_MINUTES} minutes. If you didn't ask for it, ignore this email.`,
  hi: (l) =>
    `TripSaver में साइन इन करने के लिए यह लिंक खोलें:\n\n${l}\n\nयह ${LINK_MINUTES} मिनट तक एक बार काम करेगा। अगर आपने यह नहीं माँगा, तो इस ईमेल को अनदेखा करें।`,
  bn: (l) =>
    `TripSaver-এ সাইন ইন করতে এই লিঙ্কটি খুলুন:\n\n${l}\n\nএটি ${LINK_MINUTES} মিনিট পর্যন্ত একবার কাজ করবে। আপনি না চাইলে এই ইমেলটি উপেক্ষা করুন।`,
};

@Injectable()
export class AuthService {
  readonly webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

  constructor(
    @Inject(ACCOUNT_STORE) private readonly store: AccountStore,
    @Inject(MAILER) private readonly mailer: Mailer,
    @Inject(GOOGLE_AUTH) readonly google: GoogleAuth,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  get secureCookies(): boolean {
    return this.webOrigin.startsWith('https://');
  }

  get googleRedirectUri(): string {
    return `${this.webOrigin}/api/auth/google/callback`;
  }

  /**
   * Emails a one-time sign-in link. Always "succeeds" from the caller's point of view, so the form
   * doesn't reveal which addresses have accounts; extra requests for one address are dropped quietly.
   */
  async requestEmailLink(email: string, locale: string, next: string): Promise<void> {
    const now = this.clock();
    if (
      (await this.store.countRecentLoginTokens(email, new Date(now.getTime() - LINK_MINUTES * 60_000))) >=
      MAX_LINKS
    )
      return;
    const token = newSecret();
    await this.store.createLoginToken(
      hashSecret(token),
      email,
      new Date(now.getTime() + LINK_MINUTES * 60_000),
    );
    // The link opens a page with a "Continue" button: mail scanners that prefetch links don't use up the token.
    const link = `${this.webOrigin}/signin/verify?${new URLSearchParams({ token, next })}`;
    const lang = SUBJECT[locale] ? locale : 'en';
    await this.mailer.send({ to: email, subject: SUBJECT[lang]!, text: BODY[lang]!(link) });
  }

  /** Uses a sign-in link: the user for that email (created on first sign-in), or null. */
  async verifyEmailLink(token: string): Promise<AccountUser | null> {
    const email = await this.store.consumeLoginToken(hashSecret(token), this.clock());
    if (!email) return null;
    const existing = await this.store.userByEmail(email);
    if (existing) {
      await this.store.markEmailVerified(existing.id);
      return existing;
    }
    return this.store.createUser({ email, emailVerified: true });
  }

  /** Google account → user: by Google id, else by the same verified email (linking it), else a new user. */
  async userFromGoogle(code: string, codeVerifier: string): Promise<AccountUser> {
    const p = await this.google.profile({ code, codeVerifier, redirectUri: this.googleRedirectUri });
    const bySub = await this.store.userByGoogleSub(p.sub);
    if (bySub) return bySub;
    if (p.email && p.emailVerified) {
      const byEmail = await this.store.userByEmail(p.email);
      if (byEmail) return this.store.linkGoogle(byEmail.id, p.sub, p.name);
    }
    return this.store.createUser({
      email: p.email && p.emailVerified ? p.email : null,
      name: p.name,
      googleSub: p.sub,
      emailVerified: p.emailVerified,
    });
  }

  /** A new session; returns the cookie value (only its hash is stored). */
  async startSession(userId: string): Promise<{ value: string; maxAgeMs: number }> {
    const value = newSecret();
    const maxAgeMs = SESSION_DAYS * 24 * 3600_000;
    await this.store.createSession(hashSecret(value), userId, new Date(this.clock().getTime() + maxAgeMs));
    return { value, maxAgeMs };
  }

  async userForSession(value: string | null): Promise<AccountUser | null> {
    return value ? this.store.sessionUser(hashSecret(value), this.clock()) : null;
  }

  async endSession(value: string | null): Promise<void> {
    if (value) await this.store.deleteSession(hashSecret(value));
  }
}
