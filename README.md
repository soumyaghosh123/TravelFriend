# TripSaver

A budget travel planner for Indian travellers. You enter six things (from, to, number of days, month, hotel type and head count), and TripSaver builds one results page with:

- **The cheapest dates in that month.** It shows a colour-coded price calendar, the three cheapest date windows, and why some dates cost more (weekends, festivals, holidays, season).
- **Three plans: Offbeat, Budget and Comfort.** Each comes with a day-by-day itinerary that respects opening hours, closed days and a 9-hour daily limit.
- **Getting there and back** by train, bus or flight, plus **hotels**, **local transport**, **sights**, **food** (real nearby eateries from OpenStreetMap), **shopping**, and **do's and don'ts**.
- **Group and per-person totals.** Every price shows its source, when it was fetched, and a booking link with dates and travellers already filled in.
- **Accounts, saved trips, a booking checklist, share links, PDF and calendar export, and price alerts.** Price alerts say "tell me when this trip drops below ₹X" and are checked daily at 07:00 India time.
- **English, Hindi and Bengali.**

> **Status:** in development. Weather (Open-Meteo) and restaurants (OpenStreetMap) are real data. Transport, hotel, sight and local-transport prices come from **mock providers**: sample data for 25 destinations, labelled as samples in the UI. Real price providers will plug in behind the existing interfaces later.

## Tech stack

A pnpm + Turborepo monorepo, written in TypeScript (strict mode) throughout.

| Part | What it is |
|---|---|
| `apps/web` | Next.js (App Router), Tailwind CSS, next-intl (en / hi / bn) |
| `apps/api` | NestJS API, results streamed over Server-Sent Events, zod validation, BullMQ jobs |
| `packages/domain` | Pure, deterministic engines: pricing, cheapest dates, itinerary planner and validator, search-input schema |
| `packages/providers` | Provider interfaces, registry, `mock/` and `real/` providers, booking deep links, section builders |
| `packages/db` | Prisma schema, migrations and seed (PostgreSQL) |

Infrastructure: PostgreSQL 16 and Redis 7, both through Docker Compose.

## Getting started

Before you start, install:

- Node.js 20 or later
- pnpm 9: `npm i -g pnpm@9`
- Docker Desktop, for the local database and Redis

Then run:

```bash
git clone https://github.com/soumyaghosh123/TravelFriend.git
cd TravelFriend
pnpm install
cp .env.example .env      # then edit .env as needed

pnpm db:up                # Postgres :5432 and Redis :6379
pnpm db:migrate           # create the tables
pnpm db:seed              # mock providers and child-pricing rules

pnpm dev                  # web http://localhost:3000, API http://localhost:4000/api
```

Open http://localhost:3000 and search, for example, **Kolkata → Goa, 10 days, December**.

### Configuration

Everything is set in `.env`. See [.env.example](.env.example) for every variable, with comments.

- **Providers.** `*_PROVIDERS` chooses mock or real sources, for example `WEATHER_PROVIDERS=openmeteo` and `RESTAURANT_PROVIDERS=osm`.
- **Email.** With `SMTP_URL` empty, sign-in links and alert emails are printed to the API log. Set it to any SMTP service (for example Mailjet or Brevo) to send real emails, and set `MAIL_FROM` to a sender address you have verified with that service.
- **Google sign-in.** Optional. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- **Dev routes.** `ENABLE_DEV_ROUTES=1` (local only) adds `POST /api/dev/alerts/run`, which runs the price-alert check straight away.

Secrets belong only in `.env`, which git ignores. Never commit it.

## Commands

```bash
pnpm test                 # Vitest in every package
pnpm --filter @tripsaver/domain test
pnpm lint
pnpm typecheck
pnpm build
pnpm db:studio            # browse the database
pnpm db:down              # stop containers (data kept)
```

## Project rules

- Every price shows its **source**, a **fetched-at** time and a **booking link**; estimates are labelled "approx.".
- Child pricing defaults: under 4 free, 4–7 half price, 8 and over full price. A provider's own child price always wins.
- The UI and engines never import a concrete provider; everything goes through `packages/providers`.
- No scraping of sites whose terms forbid it.

More detail is in [CLAUDE.md](CLAUDE.md), the product brief in [BRIEF.md](BRIEF.md), the architecture and build order in [docs/PLAN.md](docs/PLAN.md), deployment in [docs/deploy.md](docs/deploy.md), and the change history in [CHANGELOG.md](CHANGELOG.md).

## Data sources and attribution

- Restaurant data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, via the Overpass API.
- Weather from [Open-Meteo](https://open-meteo.com/). The free tier is for non-commercial use only.
- All other prices are sample data until real providers are connected.
