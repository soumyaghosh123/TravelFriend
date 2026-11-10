import type { Clock } from './clock.js';
import { withTimeout } from './dates-section.js';
import { attractionsFor } from './itinerary-section.js';
import type { DestinationGuide, ProviderSet } from './interfaces.js';
import type { GuideSection } from './results-contract.js';

/** Default local road speed when a destination doesn't set one. */
const DEFAULT_SPEED_KMH = 30;
/** Eateries are looked for within this distance of each base area (spec 2026-11-10-osm-restaurants). */
const RESTAURANT_RADIUS_KM = 3;
/** At most this many base areas per query, to keep the Overpass request small. */
const MAX_RESTAURANT_POINTS = 6;

const isSample = (id: string) => id.startsWith('mock');

/**
 * Sights, food, shopping and do's & don'ts for a destination (brief §3.4, §3.6–3.8, PLAN §12 step 8).
 * The first content provider with a guide wins. A content provider that fails or times out leaves
 * `guide: null`, so the sights still show.
 */
export async function buildGuideSection(
  set: ProviderSet,
  destination: string,
  opts: { clock: Clock; timeoutMs: number },
): Promise<GuideSection> {
  const place = set.places.get(destination);
  if (!place) throw new Error(`Unknown destination "${destination}"`);
  const landmarks = set.places.landmarks(destination);
  const points = (landmarks.length ? landmarks : [place])
    .slice(0, MAX_RESTAURANT_POINTS)
    .map(({ lat, lng }) => ({ lat, lng }));
  const [sights, guides, eateries] = await Promise.all([
    attractionsFor(set, destination, opts.timeoutMs),
    Promise.all(
      set.content.map((p) =>
        withTimeout(p.guide(destination), opts.timeoutMs, `${p.id} content`).catch(() => null),
      ),
    ),
    Promise.all(
      set.restaurants
        .filter((p) => !isSample(p.id))
        .map((p) =>
          withTimeout(
            p.near(destination, points, RESTAURANT_RADIUS_KM),
            opts.timeoutMs,
            `${p.id} restaurants`,
          ).catch(() => null),
        ),
    ),
  ]);
  const guide: DestinationGuide | null = guides.find((g) => g !== null) ?? null;
  const main = landmarks[0] ?? { name: place.name, lat: place.lat, lng: place.lng };
  const found = eateries.find((r) => r !== null && r.restaurants.length > 0) ?? null;
  return {
    destination: { code: place.code, name: place.name, kind: place.kind },
    mainArea: { name: main.name, lat: main.lat, lng: main.lng },
    speedKmh: place.localSpeedKmh ?? DEFAULT_SPEED_KMH,
    sights,
    guide,
    restaurants: found
      ? {
          list: found.restaurants,
          live: true,
          realProvider: true,
          source: {
            name: found.source.name,
            url: found.source.url,
            ...(found.source.licence ? { licence: found.source.licence } : {}),
          },
          fetchedAt: found.fetchedAt,
        }
      : {
          list: guide?.restaurants ?? [],
          live: false,
          realProvider: set.restaurants.some((p) => !isSample(p.id)),
          source: null,
          fetchedAt: null,
        },
    sampleData: [...set.attractions, ...set.content].every((p) => p.id.startsWith('mock')),
    source: [...set.attractions, ...set.content].map((p) => p.id).join(', '),
    fetchedAt: opts.clock().toISOString(),
  };
}
