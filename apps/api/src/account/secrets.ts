import { createHash, randomBytes } from 'node:crypto';

/** A random secret for a cookie or an email link (256 bits, URL-safe). */
export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

/** What we store instead of the secret itself. */
export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('base64url');
}

/** PKCE S256 code challenge for a verifier. */
export function codeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Reads one cookie from a Cookie header. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Only same-site relative paths, so a sign-in link can't send people elsewhere ("open redirect"). */
export function safeNext(next: unknown): string {
  return typeof next === 'string' && /^\/(?![/\\])[^\s]*$/.test(next) ? next : '/account';
}
