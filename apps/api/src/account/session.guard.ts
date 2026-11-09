import {
  createParamDecorator,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AccountUser } from './account-store.js';
import { AuthService, SESSION_COOKIE } from './auth.service.js';
import { readCookie } from './secrets.js';

type WithUser = Request & { user?: AccountUser };

/**
 * Requires a signed-in user. Changes (POST/PUT/DELETE) must also come from our own site: the session
 * cookie is SameSite=Lax, and we check the Origin header too (defence against cross-site requests).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<WithUser>();
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const origin = req.headers.origin;
      if (origin && origin !== this.auth.webOrigin)
        throw new ForbiddenException({ statusCode: 403, message: 'Cross-site request' });
    }
    const user = await this.auth.userForSession(readCookie(req.headers.cookie, SESSION_COOKIE));
    if (!user) throw new UnauthorizedException({ statusCode: 401, message: 'Sign in first' });
    req.user = user;
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AccountUser => ctx.switchToHttp().getRequest<WithUser>().user!,
);
