import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import type { Clock } from '../src/clock.js';
import { fixedClock } from '../src/clock.js';
import { withTimeout } from '../src/dates-section.js';
import type { RestaurantsProvider } from '../src/interfaces.js';
import { MockRestaurantsProvider } from '../src/mock/restaurants.js';
import { OsmRestaurantsProvider } from '../src/real/osm-restaurants.js';
import { createRegistry } from '../src/registry.js';

// Hand-made, shaped like a real Overpass response (tests never call the network).
const fixture = readFileSync(new URL('./fixtures/overpass-goa.json', import.meta.url), 'utf8');
const clock = fixedClock('2026-11-10T06:00:00Z');
const point = { lat: 15.553, lng: 73.752 };
const ok = () =>
  vi.fn(async () => new Response(fixture, { status: 200 })) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;
const osm = (f: typeof fetch, c: Clock = clock) =>
  new OsmRestaurantsProvider({ clock: c, fetch: f, baseUrl: 'https://overpass.test/api/interpreter' });

describe.each<[string, () => RestaurantsProvider]>([
  ['mock', () => new MockRestaurantsProvider()],
  ['osm', () => osm(ok())],
])('RestaurantsProvider contract: %s', (_name, make) => {
  test('near() gives restaurants, a source and an ISO fetchedAt', async () => {
    const res = await make().near('GOA', [point], 3);
    expect(res.restaurants.length).toBeGreaterThan(0);
    expect(res.source.id).toBeTruthy();
    expect(res.source.name).toBeTruthy();
    expect(new Date(res.fetchedAt).toISOString()).toBe(res.fetchedAt);
    for (const r of res.restaurants) {
      expect(r).toMatchObject({ id: expect.any(String), name: expect.any(String), kind: expect.any(String) });
      expect(r.vegType).toMatch(/^(veg|non-veg|both|unknown)$/);
      expect(typeof r.lat).toBe('number');
      expect(typeof r.lng).toBe('number');
    }
  });
});

describe('MockRestaurantsProvider', () => {
  test('a destination without sample places gives none', async () => {
    expect((await new MockRestaurantsProvider().near('AGRA', [point], 3)).restaurants).toEqual([]);
  });
});

describe('OsmRestaurantsProvider', () => {
  test('posts the query with our User-Agent; source is OpenStreetMap (ODbL)', async () => {
    const f = ok();
    const res = await osm(f).near('GOA', [point], 3);
    const [url, init] = f.mock.calls[0]! as [string, RequestInit];
    expect(url).toBe('https://overpass.test/api/interpreter');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('TripSaver/0.1 (travel planner)');
    expect(String(init.body)).toMatch(/^data=/);
    expect(decodeURIComponent(String(init.body).slice(5))).toContain('around:3000,15.553,73.752');
    expect(res.source).toEqual({
      id: 'osm',
      name: 'OpenStreetMap contributors',
      url: 'https://www.openstreetmap.org/copyright',
      licence: 'ODbL',
    });
    expect(res.restaurants.every((r) => r.live)).toBe(true);
  });

  test('cached per destination for 24 hours', async () => {
    let now = new Date('2026-11-10T06:00:00Z').getTime();
    const f = ok();
    const p = osm(f, () => new Date(now));
    await p.near('GOA', [point], 3);
    await p.near('GOA', [point], 3);
    expect(f).toHaveBeenCalledTimes(1);
    now += 24 * 3600_000 + 1;
    await p.near('GOA', [point], 3);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('after 24 hours the old list is served at once while a refresh runs; a failed refresh keeps it', async () => {
    let now = new Date('2026-11-10T06:00:00Z').getTime();
    let release!: () => void;
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response(fixture))
      .mockImplementationOnce(async () => {
        await new Promise<void>((r) => (release = r));
        return new Response('busy', { status: 504 });
      })
      .mockResolvedValueOnce(new Response(JSON.stringify({ elements: [] })));
    const p = osm(f as unknown as typeof fetch, () => new Date(now));
    const first = await p.near('GOA', [point], 3);
    now += 24 * 3600_000 + 1;
    // Expired: answers with the old list straight away (no waiting on Overpass), refresh in flight.
    expect(await withTimeout(p.near('GOA', [point], 3), 10, 'stale')).toBe(first);
    expect(f).toHaveBeenCalledTimes(2);
    // A second call while the refresh is in flight doesn't start another one.
    expect(await p.near('GOA', [point], 3)).toBe(first);
    expect(f).toHaveBeenCalledTimes(2);
    release();
    await new Promise((r) => setTimeout(r, 0));
    // The refresh failed: still the old list, and no new request during the 5-minute pause.
    expect(await p.near('GOA', [point], 3)).toBe(first);
    expect(f).toHaveBeenCalledTimes(2);
    now += 5 * 60_000 + 1;
    expect(await p.near('GOA', [point], 3)).toBe(first);
    expect(f).toHaveBeenCalledTimes(3);
  });

  // Fair use (decision 2026-11-10): after a refusal, no request to Overpass for 5 minutes (or its
  // Retry-After, up to an hour), for every destination: Overpass limits by our IP, not by place.
  test.each([429, 504])('HTTP %i rejects; no request for 5 minutes, for any destination', async (status) => {
    let now = new Date('2026-11-10T06:00:00Z').getTime();
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('busy', { status }))
      .mockResolvedValue(new Response(fixture, { status: 200 }));
    const p = osm(f as unknown as typeof fetch, () => new Date(now));
    await expect(p.near('GOA', [point], 3)).rejects.toThrow(`Overpass ${status}`);
    await expect(p.near('GOA', [point], 3)).rejects.toThrow('Overpass: paused');
    await expect(p.near('JAIPUR', [point], 3)).rejects.toThrow('Overpass: paused');
    expect(f).toHaveBeenCalledTimes(1);
    now += 5 * 60_000 + 1;
    await expect(p.near('GOA', [point], 3)).resolves.toMatchObject({ source: { id: 'osm' } });
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('Retry-After (seconds) sets the pause, capped at an hour', async () => {
    let now = new Date('2026-11-10T06:00:00Z').getTime();
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'Retry-After': '900' } }))
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'Retry-After': '86400' } }))
      .mockResolvedValue(new Response(fixture));
    const p = osm(f as unknown as typeof fetch, () => new Date(now));
    await expect(p.near('GOA', [point], 3)).rejects.toThrow('Overpass 429');
    now += 10 * 60_000; // past 5 min, inside the 15 min Retry-After
    await expect(p.near('GOA', [point], 3)).rejects.toThrow('Overpass: paused');
    now += 5 * 60_000 + 1;
    await expect(p.near('GOA', [point], 3)).rejects.toThrow('Overpass 429'); // a day asked for…
    now += 60 * 60_000 + 1; // …but at most an hour
    await expect(p.near('GOA', [point], 3)).resolves.toMatchObject({ source: { id: 'osm' } });
    expect(f).toHaveBeenCalledTimes(3);
  });

  test('a network failure also pauses requests', async () => {
    let now = new Date('2026-11-10T06:00:00Z').getTime();
    const f = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(new Response(fixture));
    const p = osm(f as unknown as typeof fetch, () => new Date(now));
    await expect(p.near('GOA', [point], 3)).rejects.toThrow('ECONNRESET');
    await expect(p.near('GOA', [point], 3)).rejects.toThrow('Overpass: paused');
    now += 5 * 60_000 + 1;
    await p.near('GOA', [point], 3);
    expect(f).toHaveBeenCalledTimes(2);
  });

  test('a section timeout does not cancel the request: the answer still fills the cache', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const f = vi.fn(async () => {
      await gate;
      return new Response(fixture);
    });
    const p = osm(f as unknown as typeof fetch);
    await expect(withTimeout(p.near('GOA', [point], 3), 10, 'restaurants')).rejects.toThrow('timed out');
    release();
    const later = await p.near('GOA', [point], 3);
    expect(later.restaurants.length).toBeGreaterThan(0);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('registry', () => {
  test('RESTAURANT_PROVIDERS picks osm; mock by default', () => {
    expect(createRegistry({ RESTAURANT_PROVIDERS: 'osm' }, clock).restaurants[0]!.id).toBe('osm');
    expect(createRegistry({}, clock).restaurants[0]!.id).toBe('mock-restaurants');
  });
  test('OVERPASS_URL from the registry env is where osm asks', async () => {
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(fixture));
    const set = createRegistry(
      { RESTAURANT_PROVIDERS: 'osm', OVERPASS_URL: 'https://mirror.test/api' },
      clock,
    );
    await set.restaurants[0]!.near('GOA', [point], 3);
    expect(f.mock.calls[0]![0]).toBe('https://mirror.test/api');
    f.mockRestore();
  });
});
