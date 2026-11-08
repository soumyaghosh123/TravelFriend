import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { fixedClock } from '@tripsaver/providers';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';
import { todayInIndia } from '../src/search/search.controller.js';
import { CLOCK } from '../src/tokens.js';

const briefExample = {
  from: 'KOL',
  to: 'GOA',
  days: 10,
  month: '2026-12',
  hotelTypes: ['3-star', '4-star', '5-star'],
  travellers: { adults: 2, childAges: [3, 6] },
};

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(fixedClock('2026-11-08T06:00:00Z'))
    .compile();
  app = mod.createNestApplication();
  configureApp(app, {});
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('POST /api/search', () => {
  test('accepts the brief example, fills in rooms, and the search can be read back', async () => {
    const res = await request(app.getHttpServer()).post('/api/search').send(briefExample).expect(201);
    expect(res.body.searchId).toMatch(/^[0-9a-f-]{36}$/);

    const got = await request(app.getHttpServer()).get(`/api/search/${res.body.searchId}`).expect(200);
    expect(got.body.input).toMatchObject({ from: 'KOL', to: 'GOA', days: 10, month: '2026-12' });
    expect(got.body.input.travellers).toEqual({ adults: 2, childAges: [3, 6], rooms: 1 });
    expect(got.body.createdAt).toBe('2026-11-08T06:00:00.000Z');
  });

  test('rejects invalid input with i18n message keys per field', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/search')
      .send({ ...briefExample, days: 40, month: '2026-10', hotelTypes: [] })
      .expect(400);
    expect(res.body.message).toBe('Invalid search');
    expect(res.body.issues).toEqual(
      expect.arrayContaining([
        { path: 'days', message: 'days.range' },
        { path: 'month', message: 'month.past' },
        { path: 'hotelTypes', message: 'hotelTypes.min' },
      ]),
    );
  });

  test('rejects a non-object body', async () => {
    await request(app.getHttpServer()).post('/api/search').send('"hello"').set('content-type', 'application/json').expect(400);
  });

  test('rejects place codes the directory does not know', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/search')
      .send({ ...briefExample, from: 'NOWHERE' })
      .expect(400);
    expect(res.body.issues).toEqual([{ path: 'from', message: 'from.unknown' }]);
  });
});

describe('GET /api/search/:id', () => {
  test('404 for an unknown id', async () => {
    await request(app.getHttpServer()).get('/api/search/does-not-exist').expect(404);
  });
});

describe('GET /api/places', () => {
  test('matches by city name prefix', async () => {
    const res = await request(app.getHttpServer()).get('/api/places?q=kol').expect(200);
    expect(res.body[0]).toMatchObject({ code: 'KOL', name: 'Kolkata', stations: ['HWH', 'SDAH'], airports: ['CCU'] });
  });

  test('matches by station or airport code', async () => {
    const byStation = await request(app.getHttpServer()).get('/api/places?q=hwh').expect(200);
    expect(byStation.body.map((p: { code: string }) => p.code)).toEqual(['KOL']);
    const byAirport = await request(app.getHttpServer()).get('/api/places?q=GOX').expect(200);
    expect(byAirport.body.map((p: { code: string }) => p.code)).toEqual(['GOA']);
  });

  test('an empty query lists places, capped at 8', async () => {
    const res = await request(app.getHttpServer()).get('/api/places').expect(200);
    expect(res.body).toHaveLength(8);
  });

  test('no match → empty list', async () => {
    const res = await request(app.getHttpServer()).get('/api/places?q=zzzz').expect(200);
    expect(res.body).toEqual([]);
  });
});

describe('todayInIndia', () => {
  test('uses the Indian calendar date, not UTC', () => {
    expect(todayInIndia(new Date('2026-11-08T20:00:00Z'))).toBe('2026-11-09'); // 01:30 IST
    expect(todayInIndia(new Date('2026-11-08T18:00:00Z'))).toBe('2026-11-08'); // 23:30 IST
  });
});
