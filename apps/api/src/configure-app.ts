import type { INestApplication } from '@nestjs/common';

/** Settings shared by the server and the tests. */
export function configureApp(app: INestApplication, env: Record<string, string | undefined> = process.env): void {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: env.WEB_ORIGIN ?? 'http://localhost:3000' });
}
