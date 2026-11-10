# Real restaurants from OpenStreetMap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Food tab and destination guide pages show real eateries from OpenStreetMap with an "Open in Google Maps" link, falling back to sample places when Overpass is unavailable.

**Architecture:** A new `RestaurantsProvider` interface in `packages/providers` (mock + `osm`), selected by `RESTAURANT_PROVIDERS`. `buildGuideSection` adds a section-level `restaurants` block. Pure ranking and typical-cost rules live in `packages/domain`. The web Food tab renders the block.

**Tech Stack:** TypeScript strict, Vitest, Next.js + next-intl (en/hi/bn), global `fetch` (Node 20+).

**Spec:** [docs/superpowers/specs/2026-11-10-osm-restaurants-design.md](../specs/2026-11-10-osm-restaurants-design.md)

## Global Constraints

- No invented rating or price for a real (OSM) business. The only price is the per-kind typical cost for two, through `<Price isEstimate ownEstimate>`.
- Attribution text: "Restaurant data © OpenStreetMap contributors (ODbL)", linking to `https://www.openstreetmap.org/copyright`.
- Overpass endpoint `https://overpass-api.de/api/interpreter`, overridable with `OVERPASS_URL`. User-Agent `TripSaver/0.1 (travel planner)`, with no email.
- Search radius 3 km around each point. Keep the nearest 60 per point. 24-hour in-memory cache per destination. Failures are not cached.
- Maps link: `https://www.google.com/maps/search/?api=1&query=LAT,LNG`. Show it only for live places.
- `packages/domain` stays pure. The UI never imports a concrete provider.
- Every new string goes into en, hi and bn. The existing message-sync test must pass.
- File names are kebab-case. Each task ends with tests passing and a commit.

## Review Focus

1. **Overpass slower than `PROVIDER_TIMEOUT_MS` (4 s)**: the section falls back to sample places, but the request carries on and fills the cache, so the next visit is live. Tested in Task 3 (the timeout does not drop the cache) and Task 4 (a slow provider gives `live: false`).
2. **No OSM eateries near a remote destination** (Ladakh, Andaman): an empty answer counts as "not live", the curated samples or an empty list show, and the Food tab says no places were found instead of crashing. Tested in Task 4 and Task 5.
3. **Veg or Jain traveller where every OSM place has unknown veg status**: places still show (`unknown` after `veg` and `both`) with the "veg options not confirmed" note, not an empty list. Tested in Task 1 and Task 5.
4. **Overpass answers 429 or 504**: the provider rejects, nothing is cached, and the next call tries again. Tested in Task 3.
5. **Odd OSM records** (a way with no `center`, a Devanagari-only name, a `cuisine` like `indian;regional`): no `center` means dropped, any non-empty `name` is kept as written, and cuisines are split. Tested in Task 2.

---

### Task 1: Domain — restaurants without ratings or prices

**Files:**
- Modify: `packages/domain/src/guide/guide.ts:83-136`
- Test: `packages/domain/test/guide.test.ts`

**Interfaces:**
- Produces:
  - `RestaurantLike { id; kind; vegType: 'veg'|'non-veg'|'both'|'unknown'; costForTwo?: number; rating?: number; reviewCount?: number; dishes?: string[] } & LatLng`
  - `rankRestaurants` (same signature)
  - `restaurantsForDish` (same signature; treats a missing `dishes` as `[]`)
  - `DEFAULT_COST_FOR_TWO: Record<RestaurantLike['kind'], number> = { street: 300, homely: 400, budget: 500, restaurant: 1200 }`
  - `typicalCostForTwo(kind: RestaurantLike['kind'], samples: RestaurantLike[]): number`

- [ ] **Step 1: Write failing tests** in `guide.test.ts`:
  - `rankRestaurants veg traveller orders veg, both, unknown; drops non-veg`: list `[unknown@0.01, both@0.02, veg@0.03, non-veg@0.01]`, `'budget'`, `'veg'` → ids `['veg','both','unknown']`.
  - `rankRestaurants comfort without ratings: kind order then distance`: two `restaurant` places with no `rating` at 0.02 and 0.01, plus a `budget` at 0.005 → `['near-rest','far-rest','budget']`.
  - `rankRestaurants budget without costForTwo: kind order then distance`: two `street` places with no cost at 0.02 and 0.01 → nearer first.
  - `places with ratings keep today's order`: the existing tests stay unchanged and pass.
  - `typicalCostForTwo median of same-kind samples`: samples street 200/400/600 → `400`. With only `restaurant` samples (1000, 2000), asking for `street` gives the median of all samples, `1500`. With no samples, `street` gives `300`.
  - `restaurantsForDish ignores places without dishes`.
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/domain test`. Expected: the new tests FAIL (type errors or wrong order).
- [ ] **Step 3: Implement.** Make the fields optional and add `unknown`. Veg sort key: `veg` 0, `both` 1, `unknown` 2. In comparisons, a missing `rating` counts as "no rating", so it falls through to distance. Compare by rating or cost only when both places have the value. Median of an even count is the mean of the two middle values, rounded.
- [ ] **Step 4: Run** `pnpm --filter @tripsaver/domain test && pnpm --filter @tripsaver/domain typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): rank restaurants without ratings or prices; typical cost for two`.

### Task 2: Overpass parser (pure)

**Files:**
- Modify: `packages/providers/src/interfaces.ts:214-219` (Restaurant fields)
- Create: `packages/providers/src/real/overpass-parse.ts`
- Create: `packages/providers/test/fixtures/overpass-goa.json`
- Test: `packages/providers/test/overpass-parse.test.ts`

**Interfaces:**
- Consumes: `RestaurantLike` (Task 1), `distanceKm` from `@tripsaver/domain`.
- Produces:
  - `Restaurant extends RestaurantLike { name: string; area?: string; hours?: string; note?: string; cuisine?: string[]; phone?: string; live?: boolean }`. `live` is true for real places and gates the maps link.
  - `overpassQuery(points: LatLng[], radiusM: number): string`
  - `parseOverpass(body: unknown, points: LatLng[], perPoint: number): Restaurant[]`

- [ ] **Step 1: Write the fixture** (hand-made, about 10 elements). It needs:
  - a `restaurant` node with `diet:vegetarian=only`
  - a `fast_food` node with `diet:vegetarian=yes`
  - a `cafe` node with `cuisine=coffee_shop;indian`
  - a `food_court` way with a `center`
  - a way without a `center`
  - an unnamed node
  - a node named only in Devanagari
  - a `diet:vegetarian=no` node
  - a node with `addr:street`, `addr:city`, `opening_hours` and `contact:phone`
  - the same node id repeated (from two `around` clauses)
- [ ] **Step 2: Write failing tests** in `overpass-parse.test.ts`:
  - `overpassQuery` contains `[out:json]`, one `around:3000,LAT,LNG` per point for both `node` and `way`, the regex `^(restaurant|fast_food|cafe|food_court)$`, `["name"]` and `out center tags`.
  - kinds: `fast_food` and `food_court` map to `street`, `cafe` to `budget`, `restaurant` to `restaurant`.
  - veg: `only` gives `veg`, `cuisine` containing `vegetarian` gives `veg`, `yes` gives `both`, `no` gives `non-veg`, no tag gives `unknown`.
  - ids `osm-node-<id>` / `osm-way-<id>`; a way uses `center.lat/lon`; the way without a center and the unnamed node are dropped; the repeated id appears once; the Devanagari name is kept as written.
  - `cuisine` `coffee_shop;indian` gives `['coffee shop','indian']`; `area` is `"<addr:street>, <addr:city>"`; `hours` equals `opening_hours`; `phone` comes from `contact:phone`; `live === true`; there is no `rating` or `costForTwo`.
  - `perPoint` cap: with `perPoint=2`, at most 2 places nearest each point are kept.
  - a body with no `elements` array throws `Overpass: unexpected response`.
- [ ] **Step 3: Run** `pnpm --filter @tripsaver/providers test overpass-parse`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement** both functions in `overpass-parse.ts`. Query shape: `[out:json][timeout:25];(node[...](around:R,lat,lng);way[...](around:R,lat,lng);...);out center tags;`.
- [ ] **Step 5: Run** the tests and `pnpm --filter @tripsaver/providers typecheck`. Expected: PASS. Fix any typecheck fallout in mock content where `Restaurant` changed.
- [ ] **Step 6: Commit** `feat(providers): parse OpenStreetMap eateries from Overpass`.

### Task 3: RestaurantsProvider — mock, osm, registry

**Files:**
- Modify: `packages/providers/src/interfaces.ts` (interface + `ProviderSet.restaurants`)
- Create: `packages/providers/src/mock/restaurants.ts`
- Create: `packages/providers/src/real/osm-restaurants.ts`
- Modify: `packages/providers/src/registry.ts` (factory map, `ENV_KEYS.restaurants = 'RESTAURANT_PROVIDERS'`)
- Modify: `packages/providers/src/index.ts` (exports)
- Modify: `packages/providers/src/deeplinks/index.ts` (add `googleMapsUrl`)
- Modify: `.env.example`
- Test: `packages/providers/test/restaurants-provider.test.ts`, `packages/providers/test/deeplinks.test.ts`

**Interfaces:**
- Consumes: `overpassQuery`, `parseOverpass` (Task 2).
- Produces:
  - `interface RestaurantsProvider { id: string; near(destination: string, points: LatLng[], radiusKm: number): Promise<RestaurantsResult> }`
  - `interface RestaurantsResult { restaurants: Restaurant[]; source: { id: string; name: string; url: string; licence?: string }; fetchedAt: string }`
  - `ProviderSet.restaurants: RestaurantsProvider[]`
  - `MockRestaurantsProvider` (id `mock`): returns the mock content guide's restaurants for the destination, or `[]`.
  - `OsmRestaurantsProvider(deps: { clock: Clock; fetch?: typeof fetch; baseUrl?: string; ttlMs?: number })` (id `osm`). Source: `{ id: 'osm', name: 'OpenStreetMap contributors', url: 'https://www.openstreetmap.org/copyright', licence: 'ODbL' }`.
  - `googleMapsUrl(lat: number, lng: number): string`

- [ ] **Step 1: Write failing tests:**
  - contract (`describe.each` over mock and osm with a fake fetch returning the Task 2 fixture): `near('GOA', [point], 3)` resolves to `{ restaurants: Restaurant[], source.id, fetchedAt }` (ISO); every restaurant has `id`, `name`, `kind`, `vegType`, `lat`, `lng`.
  - osm posts to `baseUrl` with the `User-Agent` header and an urlencoded `data=` body.
  - osm cache: two calls for the same destination within the TTL make 1 fetch; after the TTL (fixed clock advanced 24 h + 1 ms, so the cache must read the clock) there are 2 fetches.
  - osm failures: a 429, then a 504, then a fetch rejection each reject the promise (`Overpass 429`). A later call fetches again (no cached failure).
  - a pending osm call wrapped by `withTimeout(…, 10)` rejects on timeout, while the provider's promise still resolves later and the next call makes no new fetch.
  - registry: `createRegistry({ RESTAURANT_PROVIDERS: 'osm' }, clock).restaurants[0].id === 'osm'`; the default is `mock`.
  - `googleMapsUrl(15.5, 73.8)` gives `https://www.google.com/maps/search/?api=1&query=15.5,73.8`.
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/providers test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** Follow the cache pattern in `real/open-meteo-weather.ts` (store the promise, delete it on rejection), adding an expiry timestamp. The `osm` factory reads `OVERPASS_URL` from `process.env` (as the API already does for other env), or takes it as an injected option. The section passes `radiusKm`, and the provider turns it into metres for the query.
- [ ] **Step 4: Update `.env.example`** under the provider block:
  ```
  RESTAURANT_PROVIDERS=mock # "osm" = real eateries from OpenStreetMap (Overpass, free, no key; attribution "© OpenStreetMap contributors" required; cached 24 h)
  # OVERPASS_URL=https://overpass-api.de/api/interpreter
  ```
- [ ] **Step 5: Run** `pnpm --filter @tripsaver/providers test && pnpm --filter @tripsaver/providers typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(providers): RestaurantsProvider with OpenStreetMap (Overpass) and mock`.

### Task 4: Guide section carries the restaurants block

**Files:**
- Modify: `packages/providers/src/results-contract.ts:267-279`
- Modify: `packages/providers/src/guide-section.ts`
- Test: `packages/providers/test/mock-content.test.ts` (guide section block)

**Interfaces:**
- Consumes: `ProviderSet.restaurants`, `withTimeout`.
- Produces: `GuideSection.restaurants: { list: Restaurant[]; live: boolean; realProvider: boolean; source: { name: string; url: string; licence?: string } | null; fetchedAt: string | null }` (`realProvider`: some configured restaurants provider is not `mock`; drives the "live list unavailable" note)

- [ ] **Step 1: Write failing tests:**
  - mock registry, GOA: `restaurants.list` equals `guide.restaurants`, `live === false`, `realProvider === false`, `source === null`.
  - a fake live provider returning 2 places: `live === true`, the list is those 2, `source.name === 'OpenStreetMap contributors'`, `fetchedAt` is set. It is called with the destination's landmarks (at most 6) and `3`.
  - a fake provider (id `osm`) that rejects, or never resolves (timeout 50 ms): falls back to the samples with `live: false`, `realProvider: true`.
  - a fake provider returning `[]`: falls back with `live: false`.
  - a destination without a curated guide (e.g. `AGRA`) plus a live provider: `guide === null` and `restaurants.list` has the live places. With the mock provider, the list is `[]`.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement.** Fetch restaurants in the same `Promise.all` as the sights and content. Take the first provider that answers with a non-empty list. `live` means `source.id !== 'mock'` and the list is non-empty.
- [ ] **Step 4: Run** `pnpm --filter @tripsaver/providers test && pnpm --filter @tripsaver/api test`. Expected: PASS. The API's guide endpoint and SSE `guide` event carry the block unchanged.
- [ ] **Step 5: Commit** `feat(providers): guide section carries live restaurants with fallback to samples`.

### Task 5: Food tab shows real places

**Files:**
- Modify: `apps/web/components/food-tab.tsx`
- Modify: `apps/web/components/guide-panel.tsx:69-84` (Food renders when `content` is null but `guide.restaurants.list` is non-empty)
- Modify: `apps/web/messages/en.json`, `hi.json`, `bn.json` (`results.food`)
- Test: `apps/web/test/results-render.test.tsx`

**Interfaces:**
- Consumes: `GuideSection.restaurants` (Task 4), `rankRestaurants`, `typicalCostForTwo` (Task 1), `googleMapsUrl` (Task 3).
- Produces: `FoodTab` prop `content: DestinationGuide | null`.

- [ ] **Step 1: Add messages** under `results.food` in all three languages:
  - `placeVeg.unknown`: "Veg options not confirmed"
  - `openInMaps`: "Open in Google Maps"
  - `typicalForTwo`: "typical for two · TripSaver estimate"
  - `osmCredit`: "Restaurant data © OpenStreetMap contributors (ODbL)"
  - `checked`: "checked {ago}" (reuse the existing "ago" formatter used by `<Price>` if there is one)
  - `liveUnavailable`: "Live restaurant list unavailable. Showing sample places."
  - `noPlaces`: "We couldn't find places to eat near {name}."
  Hindi and Bengali get real translations, not English copies.
- [ ] **Step 2: Write failing render tests** (en, hi, bn) with a `GuideSection` whose `restaurants` is live (2 places with no rating, one `unknown` veg). Assert the output:
  - contains the maps URL for the first place
  - contains the translated `osmCredit` and `placeVeg.unknown`
  - contains no "(sample)" and no rating text
  - contains the typical cost
  - has no `tryAt` line under the dishes
  Second case: `guide: null` with live places renders the places list. Third case: an empty list renders `noPlaces`. Fourth case: the existing mock case (`live: false`, `realProvider: false`) still renders the sample places with ratings and no `liveUnavailable`. Fifth case: `live: false`, `realProvider: true` renders `liveUnavailable` above the sample places.
- [ ] **Step 3: Run** `pnpm --filter @tripsaver/web test`. Expected: FAIL.
- [ ] **Step 4: Implement:**
  - Live places show kind · cuisine (first 2) · `area` if present · distance · `hours` if present, a veg badge (`unknown` uses the `both` badge style), an "Open in Google Maps" link (`target="_blank" rel="noopener"`), and `<Price amount={r.costForTwo ?? typicalCostForTwo(r.kind, content?.restaurants ?? [])} isEstimate ownEstimate note={t('typicalForTwo')}>`.
  - The rating line renders only when `r.rating !== undefined`.
  - Dishes render only when `content` exists. `tryAt` renders only when `!guide.restaurants.live`.
  - Add the credit line with a link and `checked` under the places when `live`.
- [ ] **Step 5: Run** `pnpm --filter @tripsaver/web test && pnpm --filter @tripsaver/web typecheck && pnpm --filter @tripsaver/web lint`. Expected: PASS, including the en/hi/bn message-sync test.
- [ ] **Step 6: Commit** `feat(web): Food tab shows real eateries from OpenStreetMap with map links`.

### Task 6: End-to-end check, docs, changelog

**Files:**
- Modify: `CHANGELOG.md`, `docs/content-review.md`, `CLAUDE.md` (env var mention in the Commands notes)

- [ ] **Step 1: Run** `pnpm test && pnpm lint && pnpm typecheck`. Expected: all pass.
- [ ] **Step 2: Live check.** Set `RESTAURANT_PROVIDERS=osm` in `.env`, then run `pnpm db:up && pnpm dev`.
  - `curl http://localhost:4000/api/destinations/GOA/guide`: `restaurants.live` is true and the list is non-empty, with real names. A second call is instant (cached).
  - Do the same for `AGRA` (no curated guide).
  - Open a Goa result page and confirm the Food tab shows real places, working map links and the credit line.
  - Set `OVERPASS_URL=http://localhost:9` and confirm the fallback to samples.
- [ ] **Step 3: Docs.**
  - CHANGELOG entry under Unreleased: "Real restaurants (OpenStreetMap)".
  - `docs/content-review.md`: restaurants are real OSM data when `RESTAURANT_PROVIDERS=osm`; sample places remain the fallback.
  - CLAUDE.md: one line naming `RESTAURANT_PROVIDERS=osm`.
- [ ] **Step 4: Commit** `docs: real restaurants from OpenStreetMap in changelog and content review`.
