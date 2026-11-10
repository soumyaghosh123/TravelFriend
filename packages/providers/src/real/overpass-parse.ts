import { distanceKm, type LatLng } from '@tripsaver/domain';
import type { Restaurant } from '../interfaces.js';

const AMENITY = '^(restaurant|fast_food|cafe|food_court)$';

const KIND: Record<string, Restaurant['kind']> = {
  fast_food: 'street',
  food_court: 'street',
  cafe: 'budget',
  restaurant: 'restaurant',
};

/** Overpass QL: named eateries (nodes and ways) within `radiusM` of each point, ways with their centre. */
export function overpassQuery(points: LatLng[], radiusM: number): string {
  const sel = `["amenity"~"${AMENITY}"]["name"]`;
  const parts = points.flatMap((p) => {
    const at = `(around:${radiusM},${p.lat},${p.lng});`;
    return [`node${sel}${at}`, `way${sel}${at}`];
  });
  return `[out:json][timeout:25];(${parts.join('')});out center tags;`;
}

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function vegType(tags: Record<string, string>): Restaurant['vegType'] {
  const diet = tags['diet:vegetarian'];
  if (diet === 'only' || /(^|;)\s*vegetarian\s*(;|$)/.test(tags.cuisine ?? '')) return 'veg';
  if (diet === 'yes') return 'both';
  if (diet === 'no') return 'non-veg';
  return 'unknown';
}

function toRestaurant(e: OsmElement): Restaurant | null {
  const tags = e.tags ?? {};
  const name = tags.name?.trim();
  const kind = KIND[tags.amenity ?? ''];
  const lat = e.lat ?? e.center?.lat;
  const lng = e.lon ?? e.center?.lon;
  if (!name || !kind || lat === undefined || lng === undefined) return null;
  const cuisine = tags.cuisine
    ?.split(';')
    .map((c) => c.trim().replace(/_/g, ' '))
    .filter(Boolean);
  const area = [tags['addr:street'], tags['addr:suburb'] ?? tags['addr:city']].filter(Boolean).join(', ');
  const phone = tags.phone ?? tags['contact:phone'];
  return {
    id: `osm-${e.type}-${e.id}`,
    name,
    kind,
    vegType: vegType(tags),
    lat,
    lng,
    live: true,
    ...(cuisine?.length ? { cuisine } : {}),
    ...(area ? { area } : {}),
    ...(tags.opening_hours ? { hours: tags.opening_hours } : {}),
    ...(phone ? { phone } : {}),
  };
}

/**
 * Overpass JSON → restaurants: unnamed places and ways without a centre are dropped, repeated ids kept
 * once, and only the `perPoint` nearest places to each point are kept. No rating or price is invented.
 */
export function parseOverpass(body: unknown, points: LatLng[], perPoint: number): Restaurant[] {
  const elements = (body as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) throw new Error('Overpass: unexpected response');
  const unique = new Map<string, Restaurant>();
  for (const e of elements as OsmElement[]) {
    const r = toRestaurant(e);
    if (r && !unique.has(r.id)) unique.set(r.id, r);
  }
  const all = [...unique.values()];
  const keep = new Set<string>();
  for (const p of points) {
    all
      .map((r) => ({ id: r.id, d: distanceKm(p, r) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, perPoint)
      .forEach((x) => keep.add(x.id));
  }
  return all.filter((r) => keep.has(r.id));
}
