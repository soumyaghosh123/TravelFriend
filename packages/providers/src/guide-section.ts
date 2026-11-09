import type { Clock } from './clock.js';
import { withTimeout } from './dates-section.js';
import { attractionsFor } from './itinerary-section.js';
import type { DestinationGuide, ProviderSet } from './interfaces.js';
import type { GuideSection } from './results-contract.js';

/** Default local road speed when a destination doesn't set one. */
const DEFAULT_SPEED_KMH = 30;

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
  const [sights, guides] = await Promise.all([
    attractionsFor(set, destination, opts.timeoutMs),
    Promise.all(
      set.content.map((p) =>
        withTimeout(p.guide(destination), opts.timeoutMs, `${p.id} content`).catch(() => null),
      ),
    ),
  ]);
  const guide: DestinationGuide | null = guides.find((g) => g !== null) ?? null;
  const main = set.places.landmarks(destination)[0] ?? { name: place.name, lat: place.lat, lng: place.lng };
  return {
    destination: { code: place.code, name: place.name, kind: place.kind },
    mainArea: { name: main.name, lat: main.lat, lng: main.lng },
    speedKmh: place.localSpeedKmh ?? DEFAULT_SPEED_KMH,
    sights,
    guide,
    sampleData: [...set.attractions, ...set.content].every((p) => p.id.startsWith('mock')),
    source: [...set.attractions, ...set.content].map((p) => p.id).join(', '),
    fetchedAt: opts.clock().toISOString(),
  };
}
