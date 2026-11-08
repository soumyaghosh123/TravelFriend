# Changelog

## Unreleased

- Scaffold pnpm + Turborepo monorepo with `@tripsaver/domain` and `@tripsaver/providers` packages.
- Domain: pricing engine (child rules, room suggestion), cheapest-dates engine (windows, bands, top 3, reasons, month comparison).
- Providers: interfaces, registry, deep links (honest `prefilled` flag), mock trains/buses/flights/hotels/calendar/climate for Goa, Manali, Jaipur, Kerala, Darjeeling.
- Known gap: hotel extra-bed charges are not modelled yet (children under 8 share the bed).
- Local infra: `docker-compose.yml` (PostgreSQL 16 + Redis 7, healthchecks, named volumes); `DATABASE_URL` / `REDIS_URL` in `.env.example`.
- `@tripsaver/db`: Prisma 6 schema for PLAN §8 (integer-rupee money, `DATE` columns, `providerId` + `fetchedAt` on every price row), `init` migration, idempotent seed of the 6 mock providers and the default child-pricing rules from `@tripsaver/domain`.
- Build step 2 — search form:
  - Domain: shared `SearchInput` zod schema (`makeSearchInputSchema(today)`) with i18n message keys; trip must fit in the month, current month only while a window remains, rooms default to the suggestion and are capped at one per adult.
  - `apps/api` (NestJS 11): `POST /api/search` (validated, rate-limited, in-memory store), `GET /api/search/:id`, `GET /api/places?q=` via the provider registry; CORS limited to `WEB_ORIGIN`.
  - `apps/web` (Next.js 16, Tailwind 4, next-intl en/hi/bn): home page per the approved mockup — hero slideshow, 6-input search card, place autocomplete, travellers popover with child ages, fare bands and suggested rooms, hotel-type chips, "More preferences", destination cards that prefill "To"; `/trip/[id]` placeholder confirming the saved search with a "Change search" link.
  - Copy change from the mockup: adults are "18+", children "0–17 · priced by age", so airline and hotel child rules can apply to older children.
- Build step 3 — cheapest dates & price calendar:
  - Domain: windows report the legs they chose (`legs`, `LegOption.ref`); structured reasons (`event`, `nights`) for translation; `monthPeakWarning`; `nearbyCheaperMonth` (cheapest month within ±2 that is still bookable, so a December beach trip isn't pushed into the monsoon); `estimateLocalPerDay` placeholder (₹700 budget / ₹1,800 comfort per person per day, children 4–7 half, under 4 free).
  - Providers: `priceWindow` re-prices a window with bookable offers (same legs, one 3.5★+ hotel for the whole stay); `buildDatesSection` builds the whole section with per-provider timeouts; shared `results-contract` types for API and web.
  - API: `GET /api/search/:id/stream` (SSE: `dates`, then `done`; a failing provider gives `{status:'error'}` and the stream still finishes) and `GET /api/search/:id/window?style&start` for a clicked date.
  - Web: results page per the mockup — sticky summary, destination banner with weather, Budget/Comfort plan cards (Offbeat "coming soon"), 10 tabs (tab 1 live), price calendar with green→red bands, 3 cheapest windows with savings, peak-season warning, "why some dates cost more", selected-dates breakdown with a booking link per item, month comparison, when-to-book advice; `<Price>` component shows amount, "approx.", source, "checked X ago" and the booking link.
  - Calendar cells are estimates (cheapest hotel each night); the selected window is priced with one hotel for the whole stay, and the card says so when the two differ.
- Build step 4 — getting there and back:
  - Domain: `summarizeTransport` (cheapest; fastest with cheaper winning ties; best overnight = most comfortable sleeper class that runs through a night), `combineLegs` (≥ 2 h connection, ≤ 12 h wait, optional arrive-by and maximum duration), `worthShowing` (drops combined routes a direct option beats on both price and time), `minutesBetween`; fare-breakdown lines carry the child's age.
  - Mock data: routes between origin cities, so journeys can change at a hub.
  - Providers: `buildTransportSection` — every direct train, bus and flight both ways grouped into services with an offer per class, summary cards, up to 3 combined routes (return routes must arrive by the trip's last day and take at most 1.25× the slowest direct option), `noDirect` modes, `sampleData` flag.
  - API: stream now sends `dates`, `transport` (for the Budget plan's cheapest dates), `done`; `GET /api/search/:id/transport?onward&return` for other dates (validated against the month and trip length).
  - Web: tabs are clickable (Best dates, Getting there); "Getting there" with Onward/Return and Train/Bus/Flight/Combined switches, Cheapest/Fastest/Overnight cards, per-class fares with group breakdown, availability and confirmation chance, the plan's own choice highlighted, combined-route cards with the change-over wait, and the plan's transport total. Selected window and transport are shared hooks (`useSelectedWindow`, `useTransport`).
- Integration test reproducing the brief's Kolkata → Goa, December 2026 example (`buildCheapestDatesInput`).
