# Changelog

## Unreleased

- Scaffold pnpm + Turborepo monorepo with `@tripsaver/domain` and `@tripsaver/providers` packages.
- Domain: pricing engine (child rules, room suggestion), cheapest-dates engine (windows, bands, top 3, reasons, month comparison).
- Providers: interfaces, registry, deep links (honest `prefilled` flag), mock trains/buses/flights/hotels/calendar/climate for Goa, Manali, Jaipur, Kerala, Darjeeling.
- Known gap: hotel extra-bed charges are not modelled yet (children under 8 share the bed).
