import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface GoogleProfile {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

/** "Sign in with Google" (OpenID Connect, authorization code + PKCE). */
export interface GoogleAuth {
  readonly enabled: boolean;
  authUrl(args: { state: string; codeChallenge: string; redirectUri: string }): string;
  /** Exchanges the code and verifies Google's ID token (signature, issuer, audience, expiry). */
  profile(args: { code: string; codeVerifier: string; redirectUri: string }): Promise<GoogleProfile>;
}

const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

export class GoogleOidc implements GoogleAuth {
  readonly enabled = true;
  private readonly jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  authUrl({
    state,
    codeChallenge,
    redirectUri,
  }: {
    state: string;
    codeChallenge: string;
    redirectUri: string;
  }): string {
    const q = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  async profile({
    code,
    codeVerifier,
    redirectUri,
  }: {
    code: string;
    codeVerifier: string;
    redirectUri: string;
  }): Promise<GoogleProfile> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
    const { id_token: idToken } = (await res.json()) as { id_token?: string };
    if (!idToken) throw new Error('Google returned no ID token');
    const { payload } = await jwtVerify(idToken, this.jwks, { issuer: ISSUERS, audience: this.clientId });
    if (typeof payload.sub !== 'string') throw new Error('Google ID token has no subject');
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : null,
      emailVerified: payload.email_verified === true,
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  }
}

/** Google sign-in not configured: the button is hidden. */
export class GoogleDisabled implements GoogleAuth {
  readonly enabled = false;
  authUrl(): string {
    throw new Error('Google sign-in is not configured');
  }
  async profile(): Promise<GoogleProfile> {
    throw new Error('Google sign-in is not configured');
  }
}

export function googleFromEnv(env: Record<string, string | undefined>): GoogleAuth {
  return env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? new GoogleOidc(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
    : new GoogleDisabled();
}
