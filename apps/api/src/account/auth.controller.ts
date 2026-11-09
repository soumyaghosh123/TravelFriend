import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService, OAUTH_COOKIE, SESSION_COOKIE } from './auth.service.js';
import { codeChallenge, newSecret, readCookie, safeNext } from './secrets.js';

const EmailBody = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  next: z.string().max(500).optional(),
  locale: z.enum(['en', 'hi', 'bn']).optional(),
});
const VerifyBody = z.object({ token: z.string().min(20).max(200) });

/** Sign-in (PLAN §12 step 11): one-time email links and "Sign in with Google"; no passwords. */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private sameSite(req: Request): void {
    const origin = req.headers.origin;
    if (origin && origin !== this.auth.webOrigin)
      throw new ForbiddenException({ statusCode: 403, message: 'Cross-site request' });
  }

  private setSession(res: Response, s: { value: string; maxAgeMs: number }): void {
    res.cookie(SESSION_COOKIE, s.value, {
      httpOnly: true,
      secure: this.auth.secureCookies,
      sameSite: 'lax',
      path: '/',
      maxAge: s.maxAgeMs,
    });
  }

  /** Which sign-in options to show. */
  @Get('config')
  config(): { google: boolean } {
    return { google: this.auth.google.enabled };
  }

  @Get('me')
  async me(@Req() req: Request): Promise<{ user: { email: string | null; name: string | null } | null }> {
    const u = await this.auth.userForSession(readCookie(req.headers.cookie, SESSION_COOKIE));
    return { user: u ? { email: u.email, name: u.name } : null };
  }

  @Post('email')
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async email(@Req() req: Request, @Body() body: unknown): Promise<void> {
    this.sameSite(req);
    const parsed = EmailBody.safeParse(body);
    if (!parsed.success) throw new BadRequestException({ statusCode: 400, message: 'email.invalid' });
    await this.auth.requestEmailLink(
      parsed.data.email,
      parsed.data.locale ?? 'en',
      safeNext(parsed.data.next),
    );
  }

  /** The "Continue" button on /signin/verify. */
  @Post('email/verify')
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  async verify(
    @Req() req: Request,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ ok: true }> {
    this.sameSite(req);
    const parsed = VerifyBody.safeParse(body);
    const user = parsed.success ? await this.auth.verifyEmailLink(parsed.data.token) : null;
    if (!user) throw new BadRequestException({ statusCode: 400, message: 'link.expired' });
    this.setSession(res, await this.auth.startSession(user.id));
    return { ok: true };
  }

  @Get('google')
  google(@Query('next') next: string | undefined, @Res() res: Response): void {
    if (!this.auth.google.enabled)
      throw new NotFoundException({ statusCode: 404, message: 'Google sign-in is not configured' });
    const state = newSecret();
    const verifier = newSecret();
    const payload = Buffer.from(JSON.stringify({ state, verifier, next: safeNext(next) })).toString(
      'base64url',
    );
    res.cookie(OAUTH_COOKIE, payload, {
      httpOnly: true,
      secure: this.auth.secureCookies,
      sameSite: 'lax',
      path: '/api/auth/google',
      maxAge: 10 * 60_000,
    });
    res.redirect(
      302,
      this.auth.google.authUrl({
        state,
        codeChallenge: codeChallenge(verifier),
        redirectUri: this.auth.googleRedirectUri,
      }),
    );
  }

  @Get('google/callback')
  async googleCallback(
    @Req() req: Request,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    res.clearCookie(OAUTH_COOKIE, { path: '/api/auth/google' });
    const failed = () => res.redirect(302, `${this.auth.webOrigin}/account?signin=failed`);
    let saved: { state?: string; verifier?: string; next?: string } = {};
    try {
      saved = JSON.parse(
        Buffer.from(readCookie(req.headers.cookie, OAUTH_COOKIE) ?? '', 'base64url').toString('utf8') || '{}',
      );
    } catch {
      return failed();
    }
    if (!code || !state || !saved.state || state !== saved.state || !saved.verifier) return failed();
    try {
      const user = await this.auth.userFromGoogle(code, saved.verifier);
      this.setSession(res, await this.auth.startSession(user.id));
      res.redirect(302, `${this.auth.webOrigin}${safeNext(saved.next)}`);
    } catch (err) {
      console.error('[auth] Google sign-in failed:', err);
      failed();
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    this.sameSite(req);
    await this.auth.endSession(readCookie(req.headers.cookie, SESSION_COOKIE));
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
