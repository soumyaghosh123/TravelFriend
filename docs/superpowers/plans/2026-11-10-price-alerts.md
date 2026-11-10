# Price alerts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-in traveller sets "Tell me when this trip drops below ₹X" on a saved trip. A daily job re-prices it and emails them when the group total falls below ₹X, and again only on a further drop.

**Architecture:**
- **Domain:** a pure `decideAlert` rule in `packages/domain`.
- **Mock prices:** they drift ±4% a day so alerts can fire on mock data.
- **API:** a `PriceAlertChecker` that re-prices each trip through the existing date and cost pipeline behind a small `TripPricer` interface. A BullMQ job scheduler (07:00 India time) runs the checker inside the API. Alert endpoints sit under `/api/me/alerts`.
- **Web:** a "Price alert" button in the share bar, and alert rows on `/account`.

**Tech Stack:** TypeScript strict, Vitest, NestJS + supertest, Prisma (PostgreSQL), BullMQ on the existing Redis, Next.js + next-intl (en/hi/bn).

**Spec:** [docs/superpowers/specs/2026-11-10-price-alerts-design.md](../specs/2026-11-10-price-alerts-design.md)

## Global Constraints

- The alert compares the saved plan's **group total** on the saved start date, which is the "Total & book" total for that plan and date.
- `decideAlert`:
  - `startDate < today` gives `expire`.
  - `currentTotal < threshold` and (no previous email, or `currentTotal < lastNotifiedAmount`) gives `notify`.
  - Anything else gives `skip`. A total equal to the threshold is `skip`.
- Mock drift factor: `0.96 + 0.08 × draw(destination|key|date|today)`, where `today` is the clock's date in India (UTC+05:30).
- Schedule: cron `0 7 * * *`, time zone `Asia/Kolkata`, scheduler id `price-alerts`. It runs only when `REDIS_URL` is set.
- Threshold: whole rupees, `0 < threshold < today's total`. Otherwise 400 with message `alert.threshold`. Suggested value: `suggestAlertThreshold(total)`, which is 5% below the total rounded down to ₹100.
- One alert per saved trip. Deleting the trip or the user deletes its alerts (cascade).
- Money is integer rupees, shown with Indian grouping (`₹38,400`). Emails say "approx." and "prices checked at 07:00".
- `POST /api/dev/alerts/run` is registered only when `NODE_ENV !== 'production'`.
- No secrets in code. Every new web string goes into en, hi and bn. File names are kebab-case.

## Review Focus

1. **A trip whose saved month has passed** (its inputs no longer validate) is switched off and never emailed. Tested in Task 4 (`expire when inputs are stale`).
2. **A failing email** (SMTP down) doesn't record `lastNotifiedAmount`, so the next run emails again. Tested in Task 4.
3. **The saved start date is no longer bookable** (`window` returns null). The alert is skipped and logged, not switched off, and stays retryable. Tested in Task 4.
4. **An alert on someone else's trip, or on a trip that doesn't exist**, gets 404, and a non-integer or out-of-range threshold gets 400 `alert.threshold`. Tested in Task 5.
5. **The total exactly equals the threshold** is `skip`, and **the same total on the next day** after an email is `skip` (no repeat). Tested in Task 1 and Task 4.

---

### Task 1: Domain — alert decision and suggested threshold

**Files:**
- Create: `packages/domain/src/alerts/alerts.ts`
- Modify: `packages/domain/src/index.ts` (export)
- Test: `packages/domain/test/alerts.test.ts`

**Interfaces:**
- Produces:
  - `type AlertDecision = 'notify' | 'skip' | 'expire'`
  - `decideAlert(a: { threshold: number; lastNotifiedAmount: number | null; currentTotal: number; startDate: ISODate; today: ISODate }): AlertDecision`
  - `suggestAlertThreshold(total: number): number`

- [ ] **Step 1: Write failing tests.** These cases, with today `2026-11-10` and start `2026-12-06`:
  - threshold 40000, last null, total 38400 gives `notify`
  - total 40000 (equal) gives `skip`
  - total 41000 gives `skip`
  - last 38400, total 38400 gives `skip`
  - last 38400, total 37000 gives `notify`
  - last 38400, total 39000 (still below the threshold) gives `skip`
  - start `2026-11-09` gives `expire`, even when below the threshold
  - start equal to today is not `expire`
  - `suggestAlertThreshold(38400)` gives `36400` (38400 × 0.95 = 36480, rounded down to ₹100). `suggestAlertThreshold(150)` gives `100`. `suggestAlertThreshold(90)` gives `0`.
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/domain exec vitest run test/alerts.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** both functions. Compare ISO dates as strings.
- [ ] **Step 4: Run** `pnpm --filter @tripsaver/domain test && pnpm --filter @tripsaver/domain typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(domain): price alert decision and suggested threshold`.

### Task 2: Mock prices drift by day

**Files:**
- Modify: `packages/providers/src/clock.ts` (add `indiaDate`)
- Modify: `packages/providers/src/mock/pricing-model.ts`, `packages/providers/src/mock/hotels.ts:36-43`, `packages/providers/src/mock/transport.ts:65-72`
- Test: `packages/providers/test/mock-foundation.test.ts`, plus any test whose pinned amounts change

**Interfaces:**
- Produces:
  - `indiaDate(d: Date): ISODate` (UTC + 5 h 30 min, then the date part)
  - `MockDailyPriceArgs.today: ISODate` (required)

- [ ] **Step 1: Write failing tests** in `mock-foundation.test.ts`:
  - `indiaDate(new Date('2026-11-09T18:29:00Z'))` gives `'2026-11-09'`, and `'2026-11-09T18:31:00Z'` gives `'2026-11-10'`.
  - drift, same day: the same args and the same `today` give the same price.
  - drift, different day: across `today` values `2026-11-01`…`2026-11-14` for one date, at least 10 distinct prices.
  - drift is bounded: for 200 `today` values, each price ÷ the price with drift factor 1 stays within [0.96, 1.04] (± rounding). Take the undrifted value from an exported `mockDailyPriceBase(args)` (the same formula without drift), which `mockDailyPrice` multiplies.
  - Existing tests pass `today` (`'2026-11-08'`).
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/providers exec vitest run test/mock-foundation.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Mock hotel and transport providers pass `today: indiaDate(this.clock())`, using the clock they already hold.
- [ ] **Step 4: Run** `pnpm test` (all packages). Tests with pinned amounts may fail.
  - Update only the expected numbers, never the rule a test checks.
  - Ledger each file whose numbers changed.
  - If a rule-level assertion fails (for example the Goa-December peak test), stop and treat it as a defect under systematic-debugging.
- [ ] **Step 5: Run** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(providers): mock prices drift ±4% a day so price alerts can fire`.

### Task 3: Database and account store

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`PriceAlert` as in the spec's Data section)
- Create: migration `packages/db/prisma/migrations/<timestamp>_price_alerts/` via `pnpm db:migrate --name price_alerts` (Docker running)
- Modify: `apps/api/src/account/account-store.ts`, `apps/api/src/account/prisma-account-store.ts`
- Test: `apps/api/test/account-store.test.ts` (contract, both stores)

**Interfaces:**
- Produces, in `account-store.ts`:
  ```ts
  interface PriceAlertRow {
    id: string; userId: string; tripId: string; threshold: number; active: boolean;
    lastNotifiedAt: string | null; lastNotifiedAmount: number | null; lastCheckedAt: string | null; createdAt: string;
  }
  interface ActiveAlert { alert: PriceAlertRow; trip: SavedTrip; user: AccountUser & { locale: string } }
  ```
  New `AccountStore` methods:
  - `upsertAlert(userId, tripId, threshold, now): Promise<PriceAlertRow>` (one per trip; updating resets `active = true`, `lastNotifiedAmount = null`, `lastNotifiedAt = null`)
  - `listAlerts(userId): Promise<PriceAlertRow[]>`
  - `getAlert(userId, id): Promise<PriceAlertRow | null>`
  - `setAlertActive(userId, id, active): Promise<boolean>`
  - `deleteAlert(userId, id): Promise<boolean>`
  - `activeAlerts(): Promise<ActiveAlert[]>`
  - `recordAlertCheck(id, r: { checkedAt: Date; notifiedAmount?: number; deactivate?: boolean }): Promise<void>`
  - `setUserLocale(userId, locale: 'en' | 'hi' | 'bn'): Promise<void>`

- [ ] **Step 1: Write failing contract tests:**
  - upsert creates, and a second upsert for the same trip updates (same id, new threshold, notification fields reset).
  - `listAlerts` returns only that user's alerts.
  - `getAlert`, `setAlertActive` and `deleteAlert` return null or false for another user's alert.
  - `activeAlerts` excludes paused ones and includes the trip and the user with `locale` (default `'en'`, or the value after `setUserLocale(…,'hi')`).
  - `recordAlertCheck` with `notifiedAmount` sets `lastNotifiedAmount` and `lastNotifiedAt`; with `deactivate` sets `active` false; it always sets `lastCheckedAt`.
  - deleting the trip removes its alert.
- [ ] **Step 2: Run** `pnpm db:up && pnpm --filter @tripsaver/api exec vitest run test/account-store.test.ts`. Expected: FAIL (methods missing).
- [ ] **Step 3: Implement** the schema change and migration, then both stores. The in-memory store also removes alerts in `deleteTrip`.
- [ ] **Step 4: Run** `pnpm --filter @tripsaver/db build && pnpm --filter @tripsaver/api test && pnpm --filter @tripsaver/api typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): price alerts table and account store methods`.

### Task 4: Trip pricer, checker and email

**Files:**
- Create: `apps/api/src/worker/trip-pricer.ts`, `apps/api/src/worker/price-alert-checker.ts`, `apps/api/src/worker/alert-email.ts`
- Modify: `apps/api/src/tokens.ts` (`TRIP_PRICER`)
- Test: `apps/api/test/price-alerts.test.ts`

**Interfaces:**
- Consumes: `decideAlert` (Task 1), `AccountStore` alert methods (Task 3), `DatesService.window`, `CostService.plan`, `Mailer`, `todayInIndia`.
- Produces:
  - `interface TripPricer { price(trip: SavedTrip, now: Date): Promise<PricedTrip> }`
  - `type PricedTrip = { kind: 'ok'; total: number; perPerson: number; start: string; end: string } | { kind: 'stale' } | { kind: 'unavailable' }`. `stale` means the inputs no longer validate for today; `unavailable` means no trip can start on that date.
  - `class LiveTripPricer implements TripPricer`. Constructor: `(dates: DatesService, cost: CostService)`. It validates `trip.inputs` with `makeSearchInputSchema(todayInIndia(now))`, then calls `dates.window(\`alert:${trip.id}:${todayInIndia(now)}\`, input, style, start)` (a fresh cache key each day, so drifted prices are seen), then `cost.plan(...)`.
  - `class PriceAlertChecker`. Constructor: `(store, pricer, mailer, webOrigin: string)`. Method: `runOnce(now: Date): Promise<{ checked: number; notified: number; expired: number; failed: number }>`.
  - `alertEmail(a: { locale: 'en'|'hi'|'bn'; destination: string; style: string; start: string; end: string; total: number; perPerson: number; threshold: number; tripId: string; webOrigin: string }): MailMessage`

- [ ] **Step 1: Write failing tests** (in-memory store, a fake `TripPricer` with scripted totals, a recording fake mailer, `fixedClock`):
  - `notifies once below the threshold`: threshold 40000, total 38400. One email is sent to the user's address. The subject contains `₹38,400`. The body contains `₹40,000`, `approx.`, `07:00`, `${webOrigin}/account?open=${tripId}` and `${webOrigin}/account`. Then `lastNotifiedAmount === 38400`.
  - `no repeat for the same total`: a second run at 38400 sends no new email.
  - `notifies again on a further drop`: 37000 sends a second email.
  - `expire when start date passed`: the clock is after the start, so no email and the alert is inactive.
  - `expire when inputs are stale`: the pricer returns `stale`, so the alert is inactive.
  - `unavailable date is skipped and stays active`.
  - `one failing trip is skipped`: the pricer throws for trip A, and trip B is still emailed (`failed: 1, notified: 1`).
  - `mail failure is retried next run`: the mailer throws, so `lastNotifiedAmount` stays null. The next run emails.
  - `email in Hindi`: with user locale `hi`, the subject is Hindi and still contains `₹38,400`.
  - `LiveTripPricer with mock providers`: a saved Kolkata → Goa trip (10 days, Dec 2026, budget, the start of the cheapest window) gives `kind: 'ok'` and a total equal to `CostService.plan(...)` for the same window.
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/api exec vitest run test/price-alerts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Email copy, en, from the spec:
    - Subject: `Your {destination} trip is now ₹{total}`
    - Body lines: plan and dates; group total and per person; "below your ₹{threshold} alert"; "approx. · prices checked at 07:00"; "Open your trip: …"; "Stop this alert: …"
  - hi and bn: the same lines, translated.
  - Each alert runs in its own try/catch, and errors are logged with the alert id.
- [ ] **Step 4: Run** `pnpm --filter @tripsaver/api test && pnpm --filter @tripsaver/api typecheck && pnpm --filter @tripsaver/api lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): price alert checker, trip pricer and alert emails`.

### Task 5: Alerts API, dev trigger and daily schedule

**Files:**
- Create: `apps/api/src/account/alerts.controller.ts`, `apps/api/src/worker/dev-alerts.controller.ts`, `apps/api/src/worker/price-alert-scheduler.ts`
- Modify: `apps/api/src/app.module.ts`, `apps/api/package.json` (add `bullmq`), `.env.example` (comment that alerts run daily at 07:00 India time when `REDIS_URL` is set)
- Test: `apps/api/test/alerts.test.ts`

**Interfaces:**
- Consumes: Task 3 store, Task 4 `TripPricer` / `PriceAlertChecker`, `SessionGuard`, `CurrentUser`.
- Produces:
  - HTTP:
    - `POST /api/me/alerts` takes `{ tripId, threshold, locale? }` and returns `AlertView`.
    - `GET /api/me/alerts` returns `AlertView[]`.
    - `PATCH /api/me/alerts/:id` takes `{ active }` and returns 204.
    - `DELETE /api/me/alerts/:id` returns 204.
    - `POST /api/dev/alerts/run` returns the `runOnce` result.
  - `AlertView = { id, tripId, tripTitle: string | null, threshold, active, lastCheckedAt, lastNotifiedAmount, currentTotal?: number }`. `currentTotal` is set only in the POST response.
  - `priceAlertSchedule = { pattern: '0 7 * * *', tz: 'Asia/Kolkata' }`, exported from `price-alert-scheduler.ts`.

- [ ] **Step 1: Write failing supertest tests** (in-memory store, fake pricer returning total 40000):
  - signed out: 401 on every endpoint.
  - POST with threshold 38000 gives 201, `currentTotal: 40000`, `threshold: 38000`. `locale: 'hi'` is stored on the user.
  - threshold `40000`, `0`, `-5`, `38000.5` or `'abc'` gives 400 with message `alert.threshold`.
  - another user's trip, or an unknown trip, gives 404.
  - the pricer returns `stale` or `unavailable`: 400 with message `alert.unavailable`.
  - GET lists only my alerts, with the trip title.
  - PATCH `{active:false}` then GET shows `active: false`. Another user's alert id gives 404.
  - DELETE gives 204, and a second DELETE gives 404.
  - a cross-origin POST is refused (same as saved trips).
  - `POST /api/dev/alerts/run` returns `{ checked, notified, expired, failed }` when `NODE_ENV=test`, and 404 when the module is built with `NODE_ENV=production`.
  - `priceAlertSchedule` equals `{ pattern: '0 7 * * *', tz: 'Asia/Kolkata' }`.
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/api exec vitest run test/alerts.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement:**
  - `pnpm --filter @tripsaver/api add bullmq`
  - The scheduler is a Nest provider registered only when `REDIS_URL` is set. On module init it runs `queue.upsertJobScheduler('price-alerts', priceAlertSchedule)` and creates a `Worker('price-alerts', () => checker.runOnce(new Date()))`. On module destroy it closes both.
  - The dev controller is added to `controllers` only when `process.env.NODE_ENV !== 'production'`.
  - Bodies are validated with zod.
- [ ] **Step 4: Run** `pnpm --filter @tripsaver/api test && pnpm --filter @tripsaver/api typecheck && pnpm --filter @tripsaver/api lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): price alert endpoints, dev trigger and daily 07:00 schedule`.

### Task 6: Web — set an alert, manage alerts

**Files:**
- Create: `apps/web/components/price-alert-button.tsx`
- Modify: `apps/web/lib/account.ts` (alert calls), `apps/web/components/trip-share-bar.tsx` (button next to "Save trip"), `apps/web/components/account-view.tsx` (alert row per trip; `?open=<tripId>` opens that trip), `apps/web/app/account/page.tsx` (pass `open`), `apps/web/messages/{en,hi,bn}.json` (`alerts.*`)
- Test: `apps/web/test/results-render.test.tsx`, `apps/web/test/account-render.test.tsx` (create if missing)

**Interfaces:**
- Consumes: the Task 5 HTTP API, `suggestAlertThreshold` (Task 1), `useSavedTrip` (`state`, `save`).
- Produces:
  - `account.ts`:
    - `setAlert(tripId: string, threshold: number, locale: string): Promise<AlertView | { error: string }>`
    - `listAlerts(): Promise<AlertView[] | null>`
    - `setAlertActive(id: string, active: boolean): Promise<void>`
    - `deleteAlert(id: string): Promise<void>`
  - `<PriceAlertButton saved={SavedTripState} onSave={…} total={number | null} />`

- [ ] **Step 1: Add messages** (en; hi and bn translated):
  - `alerts.button` "Price alert"
  - `alerts.title` "Tell me when this trip drops below"
  - `alerts.today` "Today's total: {total}"
  - `alerts.set` "Set alert"
  - `alerts.saved` "We'll email you if it drops below {threshold}. Prices are checked every morning."
  - `alerts.signIn` "Sign in to get price alerts"
  - `alerts.errors.threshold` "Enter an amount below today's total."
  - `alerts.errors.unavailable` "This trip can't be priced right now. Try again later."
  - `alerts.row` "Alert below {threshold}"
  - `alerts.paused` "Paused"
  - `alerts.lastChecked` "checked {ago}"
  - `alerts.lastEmailed` "last emailed at {amount}"
  - `alerts.pause` "Pause"
  - `alerts.resume` "Resume"
  - `alerts.delete` "Delete alert"
- [ ] **Step 2: Write failing render tests** (en/hi/bn, no missing-message errors):
  - the share bar shows `alerts.button`.
  - `PriceAlertButton` opened with total 40000 pre-fills `38000` and shows `Today's total: ₹40,000`.
  - signed out (`saved.status === 'anonymous'`), it shows `alerts.signIn`.
  - `AccountView` with one trip and one alert (paused, last emailed 38400) shows `Alert below ₹38,000`, `Paused`, `Resume` and `last emailed at ₹38,400`.
- [ ] **Step 3: Run** `pnpm --filter @tripsaver/web test`. Expected: FAIL.
- [ ] **Step 4: Implement:**
  - Setting an alert on an unsaved trip calls `onSave()` first, then `setAlert`. If `onSave` returns `'signin'`, go to `signInHref(current URL)`.
  - The amount input is digits only, with a `₹` prefix.
  - Error messages from the API map to `alerts.errors.*`.
  - `AccountView` loads alerts with trips, and calls `openTrip` when `open` matches a trip.
- [ ] **Step 5: Run** `pnpm --filter @tripsaver/web test && pnpm --filter @tripsaver/web typecheck && pnpm --filter @tripsaver/web lint`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(web): set and manage price alerts`.

### Task 7: End-to-end check, docs, changelog

**Files:**
- Modify: `CHANGELOG.md`, `CLAUDE.md` (alerts run in the API when `REDIS_URL` is set; dev trigger), `docs/PLAN.md` §12 step 11 (alerts done)

- [ ] **Step 1: Run** `pnpm test && pnpm lint && pnpm typecheck`. Expected: all pass. Stop the dev server first if the Prisma engine file is locked.
- [ ] **Step 2: Live check** (`pnpm db:up && pnpm db:migrate && pnpm dev`):
  - Sign in (the email link is in the API log).
  - Save a Kolkata → Goa trip and set an alert just below today's total. Confirm it's listed on `/account`.
  - Call `POST /api/dev/alerts/run` and check that nothing is emailed (the total is above the threshold).
  - Use the same endpoint after setting the threshold above the total through the store, using Prisma Studio or a quick SQL update. Check that the API log shows the email with `₹` amounts and both links, and that `/account` shows "last emailed at".
  - Check that Redis has the `price-alerts` job scheduler (`redis-cli KEYS 'bull:price-alerts:*'`).
- [ ] **Step 3: Docs:**
  - CHANGELOG entry "Build step 11 (part 2) — price alerts".
  - CLAUDE.md line about alerts.
  - PLAN §12 row 11 marks price alerts done.
- [ ] **Step 4: Commit** `docs: price alerts in changelog, CLAUDE.md and plan`.
