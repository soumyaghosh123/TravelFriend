import { readFileSync } from 'node:fs';
import { describe, expect, test, vi } from 'vitest';
import { fixedClock } from '../src/clock.js';
import { buildDatesSection } from '../src/dates-section.js';
import { MockWeatherProvider } from '../src/mock/calendar.js';
import { mockPlaceDirectory } from '../src/mock/data/places.js';
import { OpenMeteoWeatherProvider } from '../src/real/open-meteo-weather.js';
import { createRegistry } from '../src/registry.js';
import { makeSearchInputSchema } from '@tripsaver/domain';

// A real Open-Meteo archive response for Goa, 2024 (recorded; tests never call the network).
const goa2024 = readFileSync(new URL('./fixtures/open-meteo-goa-2024.json', import.meta.url), 'utf8');
const clock = fixedClock('2025-06-01T00:00:00Z');

function provider(fetchImpl: typeof fetch) {
  return new OpenMeteoWeatherProvider({
    clock,
    places: mockPlaceDirectory,
    seasonal: new MockWeatherProvider(),
    fetch: fetchImpl,
    years: 1,
  });
}
const ok = () =>
  vi.fn(async () => new Response(goa2024, { status: 200 })) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;

describe('OpenMeteoWeatherProvider', () => {
  test('asks the archive for the destination’s coordinates over the last full years', async () => {
    const f = ok();
    await provider(f).climate('GOA');
    const url = new URL((f as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string);
    expect(url.origin + url.pathname).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(url.searchParams.get('latitude')).toBe('15.49');
    expect(url.searchParams.get('longitude')).toBe('73.83');
    expect(url.searchParams.get('start_date')).toBe('2024-01-01');
    expect(url.searchParams.get('end_date')).toBe('2024-12-31');
  });

  test('real Goa 2024: 12 months, dry warm December, monsoon July; price index from the seasonal source', async () => {
    const months = await provider(ok()).climate('GOA');
    expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const dec = months.find((m) => m.month === 12)!;
    expect(dec.maxC).toBeGreaterThanOrEqual(28);
    expect(dec.maxC).toBeLessThanOrEqual(36);
    expect(dec.summary).toMatch(/dry|some rainy days/);
    const jul = months.find((m) => m.month === 7)!;
    expect(jul.summary).toMatch(/monsoon/);
    expect(jul.rainMm).toBeGreaterThan(300);
    const seasonal = await new MockWeatherProvider().climate('GOA');
    expect(dec.priceIndex).toBe(seasonal.find((s) => s.month === 12)!.priceIndex);
  });

  test('caches per destination; a failure is not cached', async () => {
    const f = ok();
    const p = provider(f);
    await p.climate('GOA');
    await p.climate('GOA');
    expect(f).toHaveBeenCalledTimes(1);

    let calls = 0;
    const flaky = vi.fn(async () =>
      ++calls === 1 ? new Response('busy', { status: 503 }) : new Response(goa2024, { status: 200 }),
    ) as unknown as typeof fetch;
    const q = provider(flaky);
    await expect(q.climate('GOA')).rejects.toThrow(/503/);
    expect((await q.climate('GOA')).length).toBe(12);
  });

  test('unknown destination → no months, no request', async () => {
    const f = ok();
    expect(await provider(f).climate('NOWHERE')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  test('attribution (CC BY 4.0) with the years averaged', () => {
    expect(provider(ok()).attribution).toEqual({
      name: 'Open-Meteo.com',
      url: 'https://open-meteo.com/',
      years: { from: 2024, to: 2024 },
    });
  });

  test('WEATHER_PROVIDERS=openmeteo selects it; the dates section carries the attribution', async () => {
    const set = createRegistry({ WEATHER_PROVIDERS: 'openmeteo' }, clock);
    expect(set.weather[0]!.id).toBe('openmeteo');
    const weather = provider(ok());
    const input = makeSearchInputSchema('2025-06-01').parse({
      from: 'KOL',
      to: 'GOA',
      days: 5,
      month: '2025-12',
      hotelTypes: ['3-star'],
      travellers: { adults: 2, childAges: [] },
    });
    const dates = await buildDatesSection({ ...set, weather: [weather] }, input, {
      today: '2025-06-01',
      clock,
      timeoutMs: 4000,
    });
    expect(dates.climateSource?.name).toBe('Open-Meteo.com');
    expect(dates.climate?.month).toBe(12);
    // Sample weather carries no source.
    const sample = await buildDatesSection(createRegistry({}, clock), input, {
      today: '2025-06-01',
      clock,
      timeoutMs: 4000,
    });
    expect(sample.climateSource).toBeNull();
  });
});
