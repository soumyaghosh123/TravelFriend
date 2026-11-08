# TripSaver – Claude Code guide

TripSaver is a budget travel planner for Indian travellers. Six inputs (From, To, days, month, hotel type, head count) produce one results page with:
- the cheapest date windows and a price calendar
- three plans (Offbeat, Budget, Comfort) with day-by-day itineraries
- transport, hotels, local transport, sights, food, shopping, do's and don'ts
- group and per-person totals, with the cheapest place to book each item

Full brief: [BRIEF.md](BRIEF.md). Architecture and build order: [docs/PLAN.md](docs/PLAN.md).

## Golden rules

1. **Every price shows its source, a `fetchedAt` time, and a booking link** with dates and travellers pre-filled. Render prices only through the `<Price>` component, and label estimates "approx.".
2. Child pricing defaults (from `PricingRule`): under 4 → free, 4–7 → half, 8 and over → full. A provider's own child price always wins.
3. Itinerary: N days → N distinct days, ≤ 9 active hours per day, no attraction on its closed day, Day 1 and Day N kept light. "N days" means N−1 hotel nights, and the trip fits inside the chosen month.
4. Providers sit behind interfaces in `packages/providers`. The UI and engines never import a concrete provider.
5. `packages/domain` is pure: no I/O, no provider calls, deterministic.
6. Secrets live only in `.env`. Keep `.env.example` updated. Never scrape sites whose terms forbid it.
7. When a provider, licence or cost decision is needed, ask the user instead of guessing.

## Stack

pnpm + Turborepo monorepo, TypeScript strict throughout.
- `apps/web`: Next.js App Router, Tailwind, next-intl (en / hi / bn)
- `apps/api`: NestJS, SSE streaming, zod validation
- `packages/domain`: engines and types
- `packages/providers`: interfaces, registry, `mock/`, `real/`, `deeplinks/`
- `packages/db`: Prisma (PostgreSQL)
- Redis for caching, BullMQ for background jobs (Phase 2)

## Commands

The scaffold is created in build step 0.

```bash
docker compose up -d     # Postgres + Redis
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev                 # web :3000, api :4000
pnpm test                # Vitest/Jest across workspaces
pnpm test:e2e            # Playwright
pnpm lint && pnpm typecheck
```

## Conventions

- Money is stored as integer rupees (`number`) inside `Money { amount, currency }`. Display it with Indian digit grouping (`₹38,400`).
- Dates are ISO `YYYY-MM-DD` strings inside the domain. Use no timezone maths; the trip is in local dates.
- File names are kebab-case. React components are PascalCase. One component per file.
- Engines get unit tests first (TDD). Each mock provider has a contract test.
- Build one feature per step, in the order in `docs/PLAN.md` §12. After each step: run tests and the dev server, fix errors, commit with a clear message, and add a CHANGELOG.md entry.
