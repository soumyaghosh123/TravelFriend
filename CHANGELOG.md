# Changelog

## Unreleased

- Scaffold pnpm + Turborepo monorepo with `@tripsaver/domain` and `@tripsaver/providers` packages.
- Domain: pricing engine (child rules, room suggestion), cheapest-dates engine (windows, bands, top 3, reasons, month comparison).
- Providers: interfaces, registry, deep links (honest `prefilled` flag), mock trains/buses/flights/hotels/calendar/climate for Goa, Manali, Jaipur, Kerala, Darjeeling.
- Known gap: hotel extra-bed charges are not modelled yet (children under 8 share the bed).
- Local infra: `docker-compose.yml` (PostgreSQL 16 + Redis 7, healthchecks, named volumes); `DATABASE_URL` / `REDIS_URL` in `.env.example`.
- `@tripsaver/db`: Prisma 6 schema for PLAN §8 (integer-rupee money, `DATE` columns, `providerId` + `fetchedAt` on every price row), `init` migration, idempotent seed of the 6 mock providers and the default child-pricing rules from `@tripsaver/domain`.
- Integration test reproducing the brief's Kolkata → Goa, December 2026 example (`buildCheapestDatesInput`).
