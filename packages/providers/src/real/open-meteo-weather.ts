import { climateNormals, climateSummary, type DailyWeather, type MonthClimate } from '@tripsaver/domain';
import type { Clock } from '../clock.js';
import type { PlaceDirectory, WeatherProvider } from '../interfaces.js';

/**
 * Real monthly weather from the Open-Meteo historical archive (https://open-meteo.com), averaged over
 * the last `years` full years at the destination's coordinates. No API key.
 *
 * Licence: data CC BY 4.0, so the attribution is shown next to the weather. The free API is for
 * non-commercial use; a commercial launch needs Open-Meteo's paid plan (decision 2026-11-09).
 *
 * `priceIndex` (how dear a month is) is not weather: it comes from `seasonal` (sample data until a
 * real price history exists).
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  id = 'openmeteo';
  attribution: NonNullable<WeatherProvider['attribution']>;
  private readonly cache = new Map<string, Promise<MonthClimate[]>>();
  private readonly years: number;
  private readonly firstYear: number;
  private readonly lastYear: number;

  constructor(
    private readonly deps: {
      clock: Clock;
      places: PlaceDirectory;
      seasonal: WeatherProvider;
      fetch?: typeof fetch;
      years?: number;
      baseUrl?: string;
    },
  ) {
    this.years = deps.years ?? 5;
    this.lastYear = deps.clock().getUTCFullYear() - 1;
    this.firstYear = this.lastYear - this.years + 1;
    this.attribution = {
      name: 'Open-Meteo.com',
      url: 'https://open-meteo.com/',
      years: { from: this.firstYear, to: this.lastYear },
    };
  }

  climate(destination: string): Promise<MonthClimate[]> {
    const hit = this.cache.get(destination);
    if (hit) return hit;
    const p = this.load(destination);
    this.cache.set(destination, p);
    // Don't keep failures: the next search tries again.
    p.catch(() => this.cache.delete(destination));
    return p;
  }

  private async load(destination: string): Promise<MonthClimate[]> {
    const place = this.deps.places.get(destination);
    if (!place) return [];
    const q = new URLSearchParams({
      latitude: String(place.lat),
      longitude: String(place.lng),
      start_date: `${this.firstYear}-01-01`,
      end_date: `${this.lastYear}-12-31`,
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
      timezone: 'Asia/Kolkata',
    });
    const res = await (this.deps.fetch ?? fetch)(
      `${this.deps.baseUrl ?? 'https://archive-api.open-meteo.com'}/v1/archive?${q}`,
      {
        headers: { 'User-Agent': 'TripSaver/0.1 (travel planner)' },
      },
    );
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body = (await res.json()) as {
      daily?: {
        time: string[];
        temperature_2m_max: (number | null)[];
        temperature_2m_min: (number | null)[];
        precipitation_sum: (number | null)[];
      };
    };
    const d = body.daily;
    if (!d) throw new Error('Open-Meteo: no daily data');
    const days: DailyWeather[] = d.time.map((date, i) => ({
      date,
      maxC: d.temperature_2m_max[i] ?? null,
      minC: d.temperature_2m_min[i] ?? null,
      rainMm: d.precipitation_sum[i] ?? null,
    }));
    const seasonal = await this.deps.seasonal.climate(destination).catch(() => [] as MonthClimate[]);
    return climateNormals(days).map((n) => ({
      month: n.month,
      maxC: Math.round(n.maxC),
      minC: Math.round(n.minC),
      summary: climateSummary(n),
      priceIndex: seasonal.find((s) => s.month === n.month)?.priceIndex ?? 1,
      rainMm: Math.round(n.rainMm),
      rainyDays: Math.round(n.rainyDays),
    }));
  }
}
