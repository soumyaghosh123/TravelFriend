# Real restaurants in the Food tab (OpenStreetMap) — design

Approved in conversation on 2026-11-10.

## Goal

The Food tab and destination guide pages show real eateries with their exact location, instead of the
"(sample)" restaurants we made up. Each place gets an "Open in Google Maps" link.

## Decisions

| Question | Decision |
|---|---|
| Data source | **OpenStreetMap through the public Overpass API.** Free, no key, no approval. Licence ODbL: show "© OpenStreetMap contributors". |
| Location display | Area or address plus an **"Open in Google Maps"** link to the coordinates (`https://www.google.com/maps/search/?api=1&query=LAT,LNG`). No embedded map, no Maps API. |
| Ratings and prices | OSM has none. **No invented rating or price for a real business.** Each place type gets a typical cost for two, labelled "approx. · TripSaver estimate". |
| "Where to eat" under each dish | Hidden for OSM places (OSM doesn't say who makes a dish). Dish, typical price and veg tag stay. |
| When Overpass fails | Show the current sample places with their "(sample)" labels and "Live restaurant list unavailable". |

## Provider (`packages/providers`)

```ts
interface RestaurantsProvider {
  id: string;
  /** Eateries within `radiusKm` of any of the points (base areas, plan hotels). */
  near(destination: string, points: LatLng[], radiusKm: number): Promise<RestaurantsResult>;
}

interface RestaurantsResult {
  restaurants: Restaurant[];
  source: { id: string; name: string; url: string; licence?: string };
  fetchedAt: string;
}
```

Selected with `RESTAURANT_PROVIDERS=mock|osm` (default `mock`; tests use mock). `.env.example` gets the
variable with a comment about attribution and fair use.

- **`mock`**: returns the existing sample restaurants from the mock content data.
- **`osm` (`real/osm-restaurants.ts`)**:
  - One Overpass query per destination: `node` and `way` with `amenity` in `restaurant | fast_food | cafe |
    food_court` around each point (`around:3000`), `out center tags`. Endpoint
    `https://overpass-api.de/api/interpreter`, overridable with `OVERPASS_URL`.
  - Timeout from the existing per-provider timeout. User-Agent `TripSaver/0.1` (no personal email).
  - Cache per destination for 24 hours in memory (like the Open-Meteo weather provider; `packages/providers`
    has no Redis). Failures are not cached; a section timeout does not cancel the request, so the result
    still lands in the cache for the next visitor. This keeps us far inside the public server's fair-use
    guidance (under 10,000 queries a day).
  - Results are capped (nearest 60 per point) and de-duplicated by OSM id.

### Mapping OSM tags to `Restaurant`

| Field | From OSM |
|---|---|
| `id` | `osm-node-123` / `osm-way-456` |
| `name` | `name` (required; unnamed places are dropped); `name:hi`/`name:bn` not used yet |
| `lat`, `lng` | node position, or way `center` |
| `kind` | `fast_food`, `food_court` → `street`; `cafe` → `budget`; `restaurant` → `restaurant` |
| `vegType` | `diet:vegetarian=only` or `cuisine` containing `vegetarian` → `veg`; `diet:vegetarian=yes` → `both`; `diet:vegetarian=no` → `non-veg`; otherwise `unknown` |
| `cuisine` | `cuisine`, split on `;`, underscores to spaces |
| `hours` | `opening_hours` as written, or absent |
| `area` | `addr:street` + `addr:suburb`/`addr:city` when present, else absent |
| `phone` | `phone` or `contact:phone` when present |
| `mapsUrl` | built from `lat`, `lng` |

## Domain (`packages/domain`, pure)

- `RestaurantLike`: `rating`, `reviewCount`, `costForTwo` and `dishes` become optional; `vegType` gains
  `unknown`.
- `rankRestaurants`:
  - Veg and Jain travellers: `veg` first, then `both`, then `unknown`; `non-veg` still excluded.
  - Comfort without ratings: kind order, then distance. Places with a rating keep today's order.
  - Budget / Offbeat without `costForTwo`: kind order, then distance.
- `typicalCostForTwo(kind, guide)`: median `costForTwo` of the destination's sample places of that kind
  (falls back to all kinds). Used for the "approx. · TripSaver estimate" figure.

## Section (`buildGuideSection`)

Gets restaurants from the selected `RestaurantsProvider` for the destination's landmarks (base areas;
hotels sit near them). The result goes in a new section-level block, so destinations without a curated
guide (the 20 newer ones) get real eateries too:

```ts
GuideSection.restaurants: {
  list: Restaurant[];
  live: boolean;                 // true when a real provider answered with at least one place
  realProvider: boolean;         // a non-mock restaurants provider is configured ("live list unavailable" note)
  source: { name: string; url: string; licence?: string } | null;
  fetchedAt: string | null;
}
```

On failure, timeout or an empty answer the list is the curated guide's sample restaurants (or empty),
`live: false`. The Food tab uses this list instead of `guide.restaurants`. When there is no curated guide
but the list has places, the Food tab shows the places and hides the dishes.

## Web

- Food tab and `/destination/[slug]` show, for each place: name, kind, cuisine, veg badge (or "veg
  options not confirmed" for `unknown`), distance by road from the hotel, opening hours when known, and
  the "Open in Google Maps" link.
- The typical cost for two per place type goes through `<Price>` labelled approx., source "TripSaver
  estimate".
- Footnote: "Restaurant data © OpenStreetMap contributors (ODbL)" linking to
  `https://www.openstreetmap.org/copyright`, with "checked X ago".
- "Where to eat it" under dishes only shows when the places are sample places.
- en / hi / bn strings for all of the above.

## Testing

- OSM parser against a saved Overpass response fixture (no network in tests): kinds, veg mapping,
  unnamed places dropped, ways use `center`, hours and address optional, de-duplication.
- Provider: timeout and HTTP error give a rejected promise; cache hit makes no second request (fake
  fetch).
- Domain: ranking with missing ratings and prices, `unknown` veg ordering, `typicalCostForTwo`.
- `RestaurantsProvider` contract test for mock and osm (osm with fake fetch).
- `buildGuideSection`: live list replaces samples; failure falls back with `restaurantsLive: false`.
- Web: en/hi/bn render test with an OSM-style guide (no rating, unknown veg, maps link, attribution).

## Out of scope

Embedded maps, ratings or reviews from any source, Hindi/Bengali place names, real restaurants for the
"where to eat it" list, and real shops.
