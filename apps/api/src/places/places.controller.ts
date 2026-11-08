import { Controller, Get, Inject, Query } from '@nestjs/common';
import type { Place, ProviderSet } from '@tripsaver/providers';
import { PROVIDER_SET } from '../tokens.js';

export interface PlaceSuggestion {
  code: string;
  name: string;
  kind: Place['kind'];
  /** e.g. "Howrah (HWH) · CCU airport · Esplanade bus" style hint, built by the UI from these. */
  stations: string[];
  airports: string[];
  busPoints: string[];
}

const MAX_RESULTS = 8;

function rank(p: Place, q: string): number {
  const name = p.name.toLowerCase();
  if (name.startsWith(q) || p.code.toLowerCase() === q) return 0;
  if (name.includes(q)) return 1;
  const codes = [...p.stations, ...p.airports].map((c) => c.toLowerCase());
  if (codes.includes(q)) return 2;
  if (p.busPoints.some((b) => b.toLowerCase().includes(q))) return 3;
  return -1;
}

/** Autocomplete for the From / To fields: cities, regions, stations, airports and bus points. */
@Controller('places')
export class PlacesController {
  constructor(@Inject(PROVIDER_SET) private readonly providers: ProviderSet) {}

  @Get()
  suggest(@Query('q') q?: string): PlaceSuggestion[] {
    const query = (q ?? '').trim().toLowerCase().slice(0, 60);
    const all = this.providers.places.places();
    const matches = query
      ? all
          .map((p) => ({ p, r: rank(p, query) }))
          .filter((x) => x.r >= 0)
          .sort((a, b) => a.r - b.r || a.p.name.localeCompare(b.p.name))
          .map((x) => x.p)
      : all;
    return matches.slice(0, MAX_RESULTS).map(({ code, name, kind, stations, airports, busPoints }) => ({
      code,
      name,
      kind,
      stations,
      airports,
      busPoints,
    }));
  }
}
