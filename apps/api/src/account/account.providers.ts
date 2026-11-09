import type { Provider } from '@nestjs/common';
import { ACCOUNT_STORE, GOOGLE_AUTH, MAILER } from '../tokens.js';
import { InMemoryAccountStore, type AccountStore } from './account-store.js';
import { googleFromEnv } from './google.js';
import { mailerFromEnv } from './mailer.js';

/** PostgreSQL when `DATABASE_URL` is set (dev via docker compose, production); in-memory otherwise (tests). */
export function accountProviders(env: Record<string, string | undefined> = process.env): Provider[] {
  return [
    {
      provide: ACCOUNT_STORE,
      useFactory: async (): Promise<AccountStore> => {
        if (!env.DATABASE_URL) return new InMemoryAccountStore();
        const [{ prisma }, { PrismaAccountStore }] = await Promise.all([
          import('@tripsaver/db'),
          import('./prisma-account-store.js'),
        ]);
        return new PrismaAccountStore(prisma);
      },
    },
    { provide: MAILER, useFactory: () => mailerFromEnv(env) },
    { provide: GOOGLE_AUTH, useFactory: () => googleFromEnv(env) },
  ];
}
