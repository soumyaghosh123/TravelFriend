# TripSaver – Architecture & Build Plan

Status: **Design approved 2026-11-08** · Source brief: [../BRIEF.md](../BRIEF.md)

---

## 1. Goal

TripSaver turns six inputs — **From, To, number of days, month, hotel type, head count** — into one results page containing:

- the 3 cheapest date windows in the month, a colour-coded price calendar, and explanations of why dates are cheap or expensive;
- three complete plans (**Offbeat, Budget, Comfort**), each with a day-by-day itinerary, hotels (3★+ list and 5★ list), transport there and back (train / bus / flight), local transport, sightseeing, food, shopping, do's & don'ts;
- total cost per person and for the group, with the cheapest site and a pre-filled booking link for every item.

Primary market: Indian travellers, INR. International destinations must be addable later.

### Non-negotiable rules

1. **Every price shows its source site, a `fetchedAt` time, and a working booking link** with dates and travellers pre-filled. Estimates are labelled "approx.".
2. **Child pricing** defaults: age < 4 → free; 4 ≤ age ≤ 7 → half; age > 7 → full. A provider's own child/infant price always overrides the default.
3. **Itinerary**: N-day trip → N distinct days; no day > 9 active hours; no attraction on its closed day; first and last days are light.
4. **Providers are swappable** behind interfaces; the UI never knows which provider is behind the data.
5. **No secrets in code**; API keys only in `.env`.

### Agreed assumptions

| # | Assumption |
|---|---|
| A1 | "N days" = N calendar days. Day 1 = onward travel/arrival; Day N = return. **Hotel nights = nights actually spent at the destination** (at most N−1). Nights on an overnight train or bus are not hotel nights. When a slow mode eats more than 20% of the trip, the plan suggests the faster alternative with its extra cost (e.g. "Fly instead for +₹8,400 and get 2 more days in Goa"). |
| A2 | The whole trip must fit **inside the chosen month** (10 days in December → start dates 1–22 Dec). |
| A3 | The half-price band is **inclusive**: ages 4, 5, 6 and 7 pay half. |
| A4 | MVP has no login, no payments, no real APIs — mock providers only. Accounts and alerts are Phase 2. |

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Language | TypeScript (strict) everywhere |
| Web | Next.js (App Router), React, Tailwind CSS, next-intl (en / hi / bn), Mapbox GL (or Google Maps) |
| API | NestJS, Server-Sent Events for streamed results, class-validator / zod for input validation |
| Domain logic | Pure TypeScript package (`packages/domain`) — no I/O |
| Database | PostgreSQL via Prisma |
| Cache / queue | Redis; BullMQ for background price refresh and alerts (Phase 2) |
| Tests | Vitest (domain, providers), Jest/Supertest (API), Playwright (end-to-end smoke) |
| PDF | @react-pdf/renderer |
| Local infra | docker-compose (Postgres + Redis) |
| Deploy | Vercel (web), AWS (API, worker, RDS, ElastiCache) |

Rejected alternatives: Next.js-only (background jobs and provider DI fit poorly on serverless); FastAPI backend (second language and duplicated types).

---

## 3. System architecture

```
┌──────────────────────── apps/web (Next.js + Tailwind) ────────────────────────┐
│ Home/Search · Results (sticky bar + 3 plan cards + tabs) · Hotel detail        │
│ Transport detail · Itinerary (timeline + map) · Destination guide (SSR, SEO)   │
│ Account (Phase 2) · Admin                                                      │
└──────────────▲──────────────────── SSE stream of result sections ──────────────┘
               │ REST + SSE
┌──────────────┴────────────────────── apps/api (NestJS) ──────────────────────────┐
│ SearchModule ─► TripOrchestrator                                                  │
│                  1. resolve places  2. fan-out to providers (parallel, timeouts)  │
│                  3. build price grids  4. run engines  5. stream sections         │
│ TripModule (recompute, share, export) · ContentModule · AdminModule · ClickModule │
│                                                                                   │
│ ┌─────────── packages/domain (pure, deterministic, unit-tested) ───────────────┐  │
│ │ PricingEngine · CheapestDatesEngine · PlanBuilder (3 strategies)            │  │
│ │ BaseSplitter · ItineraryEngine · ValueScore · CostSummary · BookingChecklist │  │
│ └──────────────────────────────────────────────────────────────────────────────┘  │
│ ┌─────────── packages/providers (interfaces + registry + adapters) ────────────┐  │
│ │ Train · Bus · Flight · Hotel · Places · LocalTransport · Weather · Content    │  │
│ │ CalendarEvents · DeepLinkBuilders                                            │  │
│ │   mock/  (Goa, Manali, Jaipur, Kerala, Darjeeling – seeded, deterministic)   │  │
│ │   real/  (added later, one adapter per provider)                             │  │
│ └──────────────────────────────────────────────────────────────────────────────┘  │
│ Redis cache (query-hash keys, TTL) · BullMQ worker (Phase 2)                      │
└────────────────────────────────────┬──────────────────────────────────────────────┘
                                     ▼
                    PostgreSQL (Prisma): content, trips, prices, users
```

**Boundary rule:** engines in `packages/domain` never call providers. The orchestrator gathers normalised data (price grids, place lists) and passes them in. Engines are therefore deterministic and testable without mocks.

---

## 4. Folder structure

```
TravelFriend/
├─ apps/
│  ├─ web/                    Next.js app
│  │  ├─ app/                 routes: /, /trip/[id], /hotel/[id], /transport, /itinerary/[id],
│  │  │                       /destination/[slug], /account, /admin
│  │  ├─ components/          SearchForm, PriceCalendar, PlanCards, tabs/*, HotelCard, ...
│  │  ├─ lib/                 api client, SSE hook, formatters (INR), i18n
│  │  └─ messages/            en.json, hi.json, bn.json
│  └─ api/                    NestJS app
│     └─ src/
│        ├─ search/           controller, orchestrator, SSE
│        ├─ trip/             recompute, share link, PDF
│        ├─ content/          destination guide endpoints
│        ├─ admin/            content, providers, pricing rules
│        ├─ clicks/           affiliate click tracking
│        └─ worker/           BullMQ jobs (Phase 2)
├─ packages/
│  ├─ domain/                 engines + shared types (src/, test/)
│  ├─ providers/              interfaces/, registry.ts, mock/, real/, deeplinks/
│  ├─ db/                     prisma/schema.prisma, migrations, seed/
│  └─ config/                 shared tsconfig, eslint, tailwind preset
├─ docs/PLAN.md
├─ BRIEF.md · CLAUDE.md · CHANGELOG.md
├─ .env.example · docker-compose.yml
└─ package.json · pnpm-workspace.yaml · turbo.json
```

---

## 5. Provider layer

### 5.1 Common types

```ts
type Money = { amount: number; currency: 'INR' | string };

interface PricedOffer {
  source: ProviderId;        // e.g. 'irctc', 'redbus', 'booking', 'mock-hotels'
  sourceName: string;        // display name, e.g. "Booking.com"
  price: Money;              // total for the group, incl. taxes and fees
  perPerson?: Money;
  breakdown?: TravellerPriceLine[];  // adults / half / free, with isEstimate per line
  isEstimate: boolean;
  fetchedAt: string;         // ISO time
  bookingUrl: string;        // deep link, dates + travellers pre-filled
}

interface Travellers { adults: number; childAges: number[]; rooms: number; }
```

### 5.2 Interfaces

| Interface | Key methods |
|---|---|
| `TrainProvider` | `fareGrid(route, month, class[])`, `search(route, date, travellers)`, `bookingWindow()` (ARP, Tatkal times) |
| `BusProvider` | `fareGrid(route, month)`, `search(route, date, travellers)` |
| `FlightProvider` | `fareGrid(route, month)`, `search(route, date, travellers)`, `nearbyAirports(city)` |
| `HotelProvider` | `search(query)`, `nightlyPriceGrid(hotelIds, month)`, `childPolicy(hotelId)` |
| `PlacesProvider` | `attractions(dest)`, `restaurants(dest)`, `shops(dest)`, `offbeatSpots(dest, radiusKm)`, `travelTime(a, b, mode)` |
| `LocalTransportProvider` | `options(leg)` → fare ranges, time, where to book, tips |
| `WeatherProvider` | `monthlyClimate(dest)`, `forecast(dest, dates)` |
| `ContentProvider` | `dishes`, `dosAndDonts`, `shoppingTips` (curated DB, `lastVerifiedOn`) |
| `CalendarEventsProvider` | `events(dest, month)` → festivals, holidays, long weekends, season |
| `DeepLinkBuilder` | `build(site, offer, dates, travellers)` per site (IRCTC, redBus, Booking, Agoda, MMT, Goibibo, Expedia, Uber, Ola, Rapido, …) |

### 5.3 Registry

`ProviderRegistry` reads `PROVIDERS_*` env vars and returns the list of active adapters per mode (e.g. `HOTEL_PROVIDERS=mock-hotels` now; `booking,agoda,mmt` later). Multiple hotel providers are queried in parallel and merged by hotel identity to produce per-site price comparison.

### 5.4 Mock providers

- Seeded, deterministic data for **Goa, Manali, Jaipur, Kerala, Darjeeling**, plus origin cities (Kolkata, Delhi, Mumbai, Bengaluru, Chennai, Hyderabad).
- Fare and hotel grids include realistic seasonality: weekend uplift, Christmas–New Year peak, Diwali, long weekends.
- Each mock destination has ≥ 25 attractions (incl. offbeat ones with footfall scores and closed days), ≥ 15 hotels across all types, ≥ 10 restaurants, ≥ 5 shops/markets, dishes, do's & don'ts.
- Deep links point to the real sites' search URLs with parameters filled.

### 5.5 Real providers (later — needs your decision on each)

| Mode | Phase 1 (real) | Phase 2+ |
|---|---|---|
| Train | Licensed rail-data provider + IRCTC deep link | IRCTC authorisation |
| Bus | redBus affiliate deep links; RTC sites | redBus SeatSeller API |
| Flight | Consolidator / metasearch affiliate (TBO, TripJack, Amadeus Enterprise – to evaluate). **Not** Amadeus Self-Service (shut down 17 Jul 2026). | Booking via consolidator |
| Hotel | Booking.com, Agoda, Expedia Rapid, MMT/Goibibo affiliate APIs | — |
| Places | Google Maps Platform or OSM + Foursquare (with attribution) | — |
| Cabs | Uber / Ola / Rapido deep links; distance-based estimates labelled "approx." | Fare APIs if granted |
| Weather | Any weather API | — |

---

## 6. Domain engines

### 6.1 PricingEngine

- Input: `Travellers`, mode, provider id, unit price, optional provider-specific child price.
- Rules come from `PricingRule` records (`mode`, `providerId | null`, `minAge`, `maxAge`, `multiplier`). Defaults: `[0–3] × 0`, `[4–7] × 0.5`, `[8+] × 1`.
- Provider child/infant prices override defaults; such lines are marked `isEstimate = false`, default-rule lines `isEstimate = true`.
- Room suggestion: `rooms = max(ceil(adults / 2), ceil((adults + childrenUnder8) / 4))`, editable by the user; extra-bed charge added when a hotel's policy requires it.
- Output label: "Approx. total for 2 adults + 2 children" + "Exact price confirmed on booking site".

### 6.2 CheapestDatesEngine

Inputs for a month M (D days) and trip length N, per plan style:

- `onward[d]` – cheapest suitable onward fare for the group on date d
- `ret[d]` – cheapest suitable return fare on date d
- `night[d]` – nightly hotel cost for the group for the night starting d
- `localPerDay` – estimate for local transport + food + sights

For each start date `s` in `1 … D−N+1`:

```
cost(s) = onward[s] + ret[r] + Σ night[a … r−1] + localPerDay × (r − a + 1)
  where a = arrival date of the onward option chosen for start s,
        r = latest return departure date whose arrival is ≤ s+N−1
```

With flights or short trips, a = s and r = s+N−1, so this is the same as N−1 hotel nights.

The hotel sum uses a prefix-sum array → O(D) per plan.

Outputs:
- calendar cells `{date, cost, band: 1..5 (green→red)}`;
- top 3 windows (cheapest first; start dates at least 3 days apart so they are real alternatives, not near-duplicates) with saving vs the most expensive window ("5–14 Dec: ₹38,400 for 4 people – save ₹9,200 vs 20–29 Dec");
- reasons per expensive date from `CalendarEvent` (weekend, festival, holiday, school holiday, peak season, local event);
- month-by-month table (cheap / normal / peak + weather) and best alternative month with % saving;
- booking-time advice (IRCTC advance reservation period, Tatkal opening, typical best lead time for flights/hotels).

### 6.3 PlanBuilder (strategy per style)

| | Offbeat | Budget | Comfort |
|---|---|---|---|
| Places | Offbeat spots (low footfall, rating ≥ 4, within radius of hub) + 1–2 highlights + local experiences | Main sights, free/low-cost first, grouped to save transport | Main sights, fewer stops/day, guided / skip-the-line |
| Stay | Homestays, eco-stays, boutique, camps | Rating ≥ 3.5, cheapest | Two lists: 3★+ and 5★ |
| Getting there | Cheapest suitable to nearest hub | Cheapest of SL/3A train, non-AC/AC bus, flight | Flight, 2A/1A/3A, premium AC bus – best comfort for time |
| Local | Shared jeeps, local buses, cabs only where none | Public transport first | Cabs for every leg |
| Food | Local, homely | Street food, budget eateries | Well-reviewed restaurants, hotel restaurant |
| Extra | Road / network / permit warnings; returns `noOffbeatAvailable + nearestAlternative` instead of forcing | — | — |

The hotel-type input filters candidate hotels inside each strategy. Comfort produces two cost totals (3★+ and 5★).

### 6.4 BaseSplitter (regions)

For region destinations (Kerala, Himachal, …): choose bases from the region's candidate bases so that each base has ≥ 2 nights, nights are proportional to sight-hours available, and total inter-base travel time is minimal (exhaustive search is fine – candidate bases ≤ 6). Adds inter-city transfer legs.

### 6.5 ItineraryEngine

1. **Cluster** attractions per base by location (grid / k-means on lat-lng).
2. **Allocate** clusters to days by available hours:
   - Day 1: arrival + check-in + light nearby sights (≤ 4 active hours after arrival).
   - Day N: checkout + return travel (≤ 3 active hours).
   - Middle days ≤ 9 active hours (visits + local travel).
   - Trips > 7 days get one flexible free day.
3. **Route** each day by nearest-neighbour from the hotel, respecting opening hours, closed days, best time of day.
4. **Fill** morning / afternoon / evening slots, meal suggestions near stops, hotel for the night (3★+ and 5★), daily spend.
5. **Validate** hard rules; a violation throws (treated as a bug, covered by tests).
6. **Re-optimise** after user edits (Phase 2 drag-and-drop) by re-running steps 3–5 on the edited day.

### 6.6 ValueScore

`score = w1·(1 − normPrice) + w2·normRating + w3·log(reviews)/k + w4·(1 − normDistance)`, weights in config. Used for "Best value" sort.

### 6.7 CostSummary & BookingChecklist

Per plan: transport to/from, hotels (all nights), local transport, sights & activities, food, shopping buffer, grand total — per person and group. Checklist rows: item → cheapest site → group price → deep link → `booked` tick box (stored in `localStorage` in MVP, in DB once accounts exist).

---

## 7. Search data flow

1. `POST /api/search` with validated inputs → `{ searchId }`.
2. Browser opens `GET /api/search/:id/stream` (SSE).
3. Orchestrator resolves origin/destination, then calls providers in parallel with per-provider timeouts (default 4 s). Results cached in Redis keyed by a hash of the normalised query (TTL: fares 30 min, hotels 60 min, content 24 h).
4. Sections are streamed as they complete:
   `dates` → `plans.summary` → `transport` → `hotels` → `itinerary` → `local` → `sights` → `food` → `shopping` → `dos` → `cost` → `done`.
5. The UI fills tabs progressively; skeletons until each section arrives.
6. Changing dates or plan → `POST /api/trip/:id/recompute { startDate, plan }` → engines re-run on cached grids (no provider calls).
7. Booking click → `GET /api/go?offer=…` → logs affiliate click, re-checks live price (when a real provider supports it), redirects.

### Error handling

- A provider that fails or times out → that section shows "Temporarily unavailable – retry"; other sections still render; totals mark the missing component.
- Missing child-price data → default rule, labelled estimate.
- No offbeat spots → Offbeat card shows the reason and nearest alternative.
- All inputs validated server-side (zod); rate limiting per IP on search.

---

## 8. Data model (Prisma, minimum)

| Model | Key fields |
|---|---|
| `User` | id, email, phone, name, locale, createdAt |
| `Trip` | id, userId?, inputs (JSON), selectedPlan, startDate, plans (JSON snapshot), shareSlug, createdAt |
| `TripDay` | tripId, dayIndex, date, baseId, activeMinutes, estSpend |
| `ItineraryItem` | tripDayId, slot (morning/afternoon/evening), kind (attraction/meal/transfer/hotel), refId, startTime, durationMin, cost |
| `Destination` | id, slug, name, state, country, isRegion, hubLat/Lng, seasons (JSON), candidateBases |
| `Landmark` | destinationId, name, lat, lng |
| `Hotel` | destinationId, name, type, stars, guestRating, reviewCount, lat, lng, amenities, childPolicy (JSON), restaurantInfo |
| `HotelPrice` | hotelId, providerId, date, price, taxes, fetchedAt |
| `TransportOption` | mode, providerId, fromCode, toCode, date, depart, arrive, durationMin, class, fare, availability, fetchedAt |
| `LocalTransportOption` | destinationId, legType, mode, fareMin, fareMax, timeMin, bookingInfo, tips |
| `Attraction` | destinationId, name, category, lat, lng, openingHours (JSON), closedDays, entryFee, avgDurationMin, bestTime, rating, footfall, isOffbeat, roadCondition, networkCoverage, permitNote |
| `Restaurant` | destinationId, name, lat, lng, costForTwo, rating, reviewCount, hours, vegType |
| `Dish` | destinationId, name, description, vegType, typicalPrice |
| `Shop` | destinationId, name, kind, whatToBuy, priceRange, bargaining, tags, rating, hours, closedDays |
| `DosAndDonts` | destinationId, category, text, lastVerifiedOn |
| `CalendarEvent` | destinationId?, name, startDate, endDate, kind (festival/holiday/longWeekend/school/season/local), priceImpact |
| `PricingRule` | mode, providerId?, minAge, maxAge, multiplier |
| `PriceAlert` | userId, tripId, thresholdAmount, active, lastNotifiedAt |
| `Provider` | id, name, mode, kind (mock/affiliate/api), enabled, commission, brandingNotes |
| `BookingChecklistItem` | tripId, itemKey, booked |
| `ClickEvent` | providerId, tripId?, offerRef, createdAt |

---

## 9. Pages & key components

| Page | Key components |
|---|---|
| `/` Home | `SearchForm` (city autocomplete, days stepper, month picker, hotel-type multi-select, `HeadCountPicker` with child ages + room suggestion, collapsible "More preferences"), popular destinations, seasonal deals |
| `/trip/[id]` Results | `StickySummaryBar`, `PlanCards` (Offbeat / Budget / Comfort), `Tabs`: `BestDatesTab` (`PriceCalendar`, `TopWindows`, `MonthCompare`, `BookingAdvice`), `DayPlanTab`, `GettingThereTab` (Train/Bus/Flight + Cheapest/Fastest/Overnight cards + multi-modal), `HotelsTab` (3★+ and 5★ columns, filters, sort), `LocalTransportTab`, `SightsTab`, `FoodTab`, `ShoppingTab`, `DosDontsTab`, `CostTab` (`CostSplit`, `BookEverythingChecklist`) |
| `/hotel/[id]` | Gallery, amenities, map, `PriceComparisonTable`, reviews, food prices |
| `/transport` | Mode tabs, filters, fare calendar |
| `/itinerary/[id]` | Timeline + map, PDF export, share (link / WhatsApp), Google Calendar (.ics) |
| `/destination/[slug]` | SSR/SSG guide: food, shopping, do's & don'ts (SEO) |
| `/account` | Saved trips, price alerts, past searches (Phase 2) |
| `/admin` | Destination content, pricing rules, providers, commissions, featured listings |

Every price is rendered through one `<Price offer={…} />` component that always shows amount, source, "checked X min ago", estimate badge, and a booking button — enforcing rule 1 in a single place.

Mobile-first; INR formatting (`₹38,400`, Indian digit grouping); currency switch later.

### 9.1 Visual design (approved 2026-11-08)

The approved mockup is [docs/design/tripsaver-mockup.html](design/tripsaver-mockup.html). Open it in a browser; it has a Desktop/Mobile toggle. The real UI follows it.

- **Colours:** teal brand `#0f766e` (dark `#115e59`, light `#ccfbf1`); saffron accent `#f59e0b` for the main call-to-action; slate text `#0f172a`; background `#f8fafc`. Price-calendar bands go from green `#dcfce7` to red `#fee2e2` in 5 steps.
- **Type:** Inter or the system sans-serif font. Large prices are bold with tight letter spacing.
- **Shapes:** cards with 14 px corners, soft shadows, pill-shaped chips.
- **Photography:**
  - The home page banner is a slideshow that crossfades between beach and mountain photos with a slow zoom and a dark tint so the text stays readable.
  - Destination cards have photos.
  - A full-width mountain photo sits behind the "Plan smart. Travel more." section.
  - The results page has a destination banner with the weather.
  - Each plan card has a photo strip along the top.
  - The mockup loads photos from Unsplash. Production stores licensed images on our own CDN, with credits.
- **Home page layout:** a search card overlapping the banner holds the 6 inputs, a travellers popover with the child-pricing rule, and a collapsible "More preferences" section.
- **Results page layout:** a sticky summary bar, the destination banner, 3 plan cards (the cheapest marked "CHEAPEST"), then 10 numbered tabs.
- **Estimates:** shown with an amber `est.` / `approx.` badge. Each price's source appears under it as "cheapest on **Site** · checked X min ago".

---

## 10. Testing strategy

| Area | Tests |
|---|---|
| PricingEngine | age-band boundaries (3, 4, 7, 8), provider override, room suggestion, extra bed |
| CheapestDatesEngine | window count (D−N+1), N−1 nights summed, top-3 ordering, saving amount, peak-reason tagging, month boundary |
| ItineraryEngine | N distinct days; every day ≤ 9 active hours; no attraction on closed day; Day 1 and Day N light; free day for N > 7; region split ≥ 2 nights per base |
| PlanBuilder | each style picks the right hotel/transport classes; rating threshold; offbeat fallback |
| CostSummary | per-person × group totals reconcile with line items |
| Providers | each mock satisfies its interface contract; deep links contain dates and traveller counts |
| API | `/search` validation, SSE section order, recompute |
| E2E (Playwright) | Brief §12 example: Kolkata → Goa, 10 days, Dec 2026, 2 adults + children aged 3 and 6 → calendar with Christmas–New Year peak warning, 3 plans, 10 days each, 6-year-old half, 3-year-old free |

Tests and dev server run after every step; failures fixed before moving on.

---

## 11. Security, legal, non-functional

- HTTPS, zod validation, rate limiting, CORS locked to web origin; no card data stored.
- Secrets only in `.env`; committed `.env.example`.
- Footer + results banner: comparison & planning service, bookings completed with partners, prices may change; affiliate disclosure; DPDP-compliant privacy policy; terms.
- Provider attribution and branding rules respected; no scraping where terms forbid.
- Performance: first section < 3 s (mock < 1 s); streaming; Redis caching.
- i18n: en, hi, bn message files from day one.
- Analytics: search events, booking click events (`ClickEvent`).

---

## 12. Build order

Each step: implement → unit tests → run dev server → fix → commit → CHANGELOG entry.

| # | Step | Done when |
|---|---|---|
| 0 | Monorepo scaffold, docker-compose, Prisma schema, `.env.example`, CLAUDE.md, lint/test wiring | `pnpm dev`, `pnpm test`, `pnpm lint` all pass |
| 1 | Provider interfaces + mock data for 5 destinations + deep-link builders | Contract tests pass |
| 2 | Search form (incl. head count, child ages, room suggestion, More preferences) | Form validates and posts; UI works on mobile |
| 3 | PricingEngine + CheapestDatesEngine + price calendar tab | Engine tests pass; Goa-December shows peak warning |
| 4 | Transport results (train / bus / flight, summary cards, multi-modal) | Both directions listed with fares and links |
| 5 | Hotel comparison (3★+ and 5★ lists, filters, sort, per-site prices) | Cheapest site highlighted, links pre-filled |
| 6 | PlanBuilder (3 styles) + BaseSplitter + ItineraryEngine + day-by-day tab | Itinerary rule tests pass |
| 7 | Local transport tab | Every leg has options, fare range, where to book |
| 8 | Sights, food, shopping, do's & don'ts tabs + destination guide pages | Content renders for all 5 destinations |
| 9 | Cost summary + Book everything checklist | Totals reconcile; checklist ticks persist |
| 10 | PDF export, share link, WhatsApp, Google Calendar (.ics) | Exported PDF matches plan |
| 11 | (Phase 2) Accounts (email / Google / OTP), saved trips, price alerts, editable itinerary | Email/Google sign-in, saved trips and price alerts done (2026-11-10); phone OTP and editable itinerary to do |

---

## 13. Decisions that need you later

These will be raised when we reach them, not guessed:

- Real flight source (TBO / TripJack / Amadeus Enterprise / metasearch affiliate).
- Licensed rail-data provider for train schedules and availability.
- Hotel affiliate programmes to apply for first.
- Maps: Google Maps Platform vs Mapbox/OSM (cost).
- Auth provider for Phase 2 (e.g. NextAuth + SMS OTP vendor).
- Hosting accounts (Vercel, AWS).
