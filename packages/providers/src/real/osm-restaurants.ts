import type { LatLng } from '@tripsaver/domain';
import type { Clock } from '../clock.js';
import type { RestaurantsProvider, RestaurantsResult } from '../interfaces.js';
import { overpassQuery, parseOverpass } from './overpass-parse.js';

const DAY_MS = 24 * 3600_000;
/** Nearest places kept per point, so a busy town doesn't flood the list. */
const PER_POINT = 60;

/**
 * Real eateries from OpenStreetMap through the public Overpass API (https://overpass-api.de). Free, no
 * key. Licence ODbL: the UI shows "© OpenStreetMap contributors" (decision 2026-11-10).
 *
 * Cached per destination for 24 hours to stay far inside the public server's fair-use guidance. A
 * failure is not cached. The request is not cancelled when a section times out, so a slow first answer
 * still serves the next visitor.
 */
export class OsmRestaurantsProvider implements RestaurantsProvider {
  id = 'osm';
  private readonly cache = new Map<string, { at: number; p: Promise<RestaurantsResult> }>();

  constructor(
    private readonly deps: { clock: Clock; fetch?: typeof fetch; baseUrl?: string; ttlMs?: number },
  ) {}

  near(destination: string, points: LatLng[], radiusKm: number): Promise<RestaurantsResult> {
    const now = this.deps.clock().getTime();
    const hit = this.cache.get(destination);
    if (hit && now - hit.at < (this.deps.ttlMs ?? DAY_MS)) return hit.p;
    const p = this.load(points, radiusKm);
    this.cache.set(destination, { at: now, p });
    p.catch(() => {
      if (this.cache.get(destination)?.p === p) this.cache.delete(destination);
    });
    return p;
  }

  private async load(points: LatLng[], radiusKm: number): Promise<RestaurantsResult> {
    const res = await (this.deps.fetch ?? fetch)(
      this.deps.baseUrl ?? 'https://overpass-api.de/api/interpreter',
      {
        method: 'POST',
        headers: {
          'User-Agent': 'TripSaver/0.1 (travel planner)',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `data=${encodeURIComponent(overpassQuery(points, Math.round(radiusKm * 1000)))}`,
      },
    );
    if (!res.ok) throw new Error(`Overpass ${res.status}`);
    return {
      restaurants: parseOverpass(await res.json(), points, PER_POINT),
      source: {
        id: this.id,
        name: 'OpenStreetMap contributors',
        url: 'https://www.openstreetmap.org/copyright',
        licence: 'ODbL',
      },
      fetchedAt: this.deps.clock().toISOString(),
    };
  }
}
