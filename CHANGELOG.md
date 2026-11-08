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
- Integration test reproducing the brief's Kolkata → Goa, December 2026 example (`buildCheapestDatesInput`).
