import type { LatLng } from '@tripsaver/domain';
import type { Clock } from '../clock.js';
import type { RestaurantsProvider, RestaurantsResult } from '../interfaces.js';
import { overpassQuery, parseOverpass } from './overpass-parse.js';

const DAY_MS = 24 * 3600_000;
/** Pause after a refusal or failure, unless Overpass sends a Retry-After (decision 2026-11-10). */
const PAUSE_MS = 5 * 60_000;
/** Longest pause we accept from a Retry-After header. */
const MAX_PAUSE_MS = 3600_000;
/** Nearest places kept per point, so a busy town doesn't flood the list. */
const PER_POINT = 60;

/** Retry-After as seconds or an HTTP date → milliseconds from `now`, or undefined. */
function retryAfterMs(header: string | null, now: number): number | undefined {
  if (!header) return undefined;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? undefined : Math.max(0, at - now);
}

class OverpassError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number,
  ) {
    super(message);
  }
}

/**
 * Real eateries from OpenStreetMap through the public Overpass API (https://overpass-api.de). Free, no
 * key. Licence ODbL: the UI shows "© OpenStreetMap contributors" (decision 2026-11-10).
 *
 * Fair use: each destination is cached for 24 hours; after expiry the last good list is served while a
 * refresh runs. After a refusal or failure, no request is sent for 5 minutes (or Overpass's Retry-After,
 * up to an hour) for any destination, because Overpass limits by our IP. During the pause a destination
 * with a cached list keeps it; others fall back to sample places. The request is not cancelled when a
 * section times out, so a slow first answer still serves the next visitor.
 */
export class OsmRestaurantsProvider implements RestaurantsProvider {
  id = 'osm';
  private readonly cache = new Map<
    string,
    {
      at: number;
      p: Promise<RestaurantsResult>;
      /** The last good answer, served while a refresh runs after it expires. */
      last?: RestaurantsResult;
      refreshing?: boolean;
    }
  >();
  /** No request to Overpass before this time (ms), after a refusal or failure. */
  private pausedUntil = 0;

  constructor(
    private readonly deps: { clock: Clock; fetch?: typeof fetch; baseUrl?: string; ttlMs?: number },
  ) {}

  near(destination: string, points: LatLng[], radiusKm: number): Promise<RestaurantsResult> {
    const now = this.deps.clock().getTime();
    const hit = this.cache.get(destination);
    if (hit && now - hit.at < (this.deps.ttlMs ?? DAY_MS)) return hit.p;
    const paused = now < this.pausedUntil;
    // Expired but we have a good answer: serve it now and refresh in the background (one at a time).
    if (hit?.last) {
      if (!hit.refreshing && !paused) {
        hit.refreshing = true;
        this.request(points, radiusKm).then(
          (res) => this.remember(destination, res),
          () => (hit.refreshing = false),
        );
      }
      return Promise.resolve(hit.last);
    }
    if (paused) return Promise.reject(new Error('Overpass: paused after a refusal'));
    const p = this.request(points, radiusKm);
    this.cache.set(destination, { at: now, p });
    p.then(
      (res) => this.remember(destination, res),
      () => {
        if (this.cache.get(destination)?.p === p) this.cache.delete(destination);
      },
    );
    return p;
  }

  private remember(destination: string, res: RestaurantsResult): void {
    this.cache.set(destination, { at: this.deps.clock().getTime(), p: Promise.resolve(res), last: res });
  }

  /** One Overpass request; any failure starts the pause. */
  private async request(points: LatLng[], radiusKm: number): Promise<RestaurantsResult> {
    try {
      return await this.load(points, radiusKm);
    } catch (e) {
      const wait = e instanceof OverpassError && e.retryAfterMs !== undefined ? e.retryAfterMs : PAUSE_MS;
      this.pausedUntil = this.deps.clock().getTime() + Math.min(wait, MAX_PAUSE_MS);
      throw e;
    }
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
    if (!res.ok)
      throw new OverpassError(
        `Overpass ${res.status}`,
        retryAfterMs(res.headers.get('Retry-After'), this.deps.clock().getTime()),
      );
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
