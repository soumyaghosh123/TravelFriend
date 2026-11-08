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
3. Itinerary: N days → N distinct days, ≤ 9 active hours per day, no attraction on its closed day, Day 1 and Day N kept light. Hotel nights are only the nights spent at the destination (at most N−1); nights on a train or bus don't count. The trip fits inside the chosen month.
8. UI follows the approved mockup [docs/design/tripsaver-mockup.html](docs/design/tripsaver-mockup.html) and the design tokens in PLAN §9.1.
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

Working now (Milestone 1: `packages/domain` and `packages/providers`, on mock data):

```bash
npm i -g pnpm@9          # once; corepack needs admin on this machine
pnpm install
pnpm test                # Vitest in every package (turbo builds dependencies first)
pnpm --filter @tripsaver/domain test      # one package
pnpm lint && pnpm typecheck
pnpm build
```

Local database (Docker Desktop must be running; copy `.env.example` to `.env` first):

```bash
pnpm db:up               # docker compose up -d --wait  (Postgres :5432, Redis :6379)
pnpm db:migrate          # prisma migrate dev  (reads the root .env)
pnpm db:seed             # mock providers + default child-pricing rules (idempotent)
pnpm db:studio           # browse data
pnpm db:down             # stop containers (data kept; `docker compose down -v` wipes it)
```

Apps (build step 2 onwards):

```bash
pnpm dev                 # web http://localhost:3000 + api http://localhost:4000/api (builds packages first)
pnpm --filter @tripsaver/api test         # NestJS + supertest, via Vitest with SWC (decorator metadata)
```

Results stream over SSE (`GET /api/search/:id/stream`: `dates` first, then `transport` and `hotels` as they complete, then `done`). Searches live in Redis when `REDIS_URL` is set. Section orchestration lives in `packages/providers` (`buildDatesSection`, `buildTransportSection`, `buildHotelsSection`); its response types are in `packages/providers/src/results-contract.ts`, which the web app imports as types only. `apps/web/test/results-render.test.tsx` renders the results components with real mock data in en/hi/bn and fails on any missing translation.

The browser calls `/api/*` on the web origin; `next.config.ts` proxies it to `API_URL`. Validation lives once in `packages/domain` (`makeSearchInputSchema`); its messages are i18n keys under `search.errors` in `apps/web/messages/*.json`, and a test keeps en/hi/bn in sync.

Coming in later milestones: `pnpm test:e2e` (Playwright).

Mock providers are selected by `*_PROVIDERS` env vars (see `.env.example`); `createRegistry(process.env)` builds them. Tests that need fixed timestamps use `fixedClock(...)`.

## Conventions

- Money is stored as integer rupees (`number`) inside `Money { amount, currency }`. Display it with Indian digit grouping (`₹38,400`).
- Dates are ISO `YYYY-MM-DD` strings inside the domain. Use no timezone maths; the trip is in local dates.
- File names are kebab-case. React components are PascalCase. One component per file.
- Engines get unit tests first (TDD). Each mock provider has a contract test.
- Build one feature per step, in the order in `docs/PLAN.md` §12. After each step: run tests and the dev server, fix errors, commit with a clear message, and add a CHANGELOG.md entry.
