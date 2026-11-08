import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port);
  console.log(`TripSaver API on http://localhost:${port}/api`);
}

void bootstrap();
