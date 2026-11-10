# Price alerts — design

Build step 11, part 2. Approved in conversation on 2026-11-10.

## Goal

A signed-in traveller can say "Tell me when this trip drops below ₹X" (BRIEF §24, §78). Once a day we
re-price the saved trip and email them when its total falls below ₹X.

## Decisions

| Question | Decision |
|---|---|
| What is compared with ₹X | The saved plan's **group total** on the saved start date — the same figure as the "Total & book" tab for that plan and date. Not other dates, not per person. |
| Mock prices never change | Mock prices **drift ±4% per day** (seeded by today's date in India), so alerts can fire in development. |
| How often | **Once a day at 07:00 India time.** |
| When to email again | Only when the total falls **below the last emailed amount**. No repeat for the same price. |
| When it stops | When the trip's start date has passed (alert is switched off), or when the user pauses / deletes it. |
| How it runs | **BullMQ job scheduler inside the API process** (`apps/api/src/worker/`), using the existing Redis. Off when `REDIS_URL` is empty. |

Real price sources are out of scope. When a real provider (Travelpayouts flights, Agoda hotels) is added
behind the existing interfaces, alerts use it with no change.

## Data

Migration `price_alerts` changes the existing `PriceAlert` model:

```prisma
model PriceAlert {
  id                 String    @id @default(cuid())
  userId             String
  user               User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tripId             String    @unique            // one alert per saved trip
  trip               Trip      @relation(fields: [tripId], references: [id], onDelete: Cascade)
  thresholdAmount    Int                           // integer rupees, group total
  active             Boolean   @default(true)
  lastNotifiedAt     DateTime?
  lastNotifiedAmount Int?                          // new
  lastCheckedAt      DateTime?                     // new
  createdAt          DateTime  @default(now())     // new

  @@index([userId])
  @@index([active])
}
```

`AccountStore` gains alert methods (`upsertAlert`, `listAlerts`, `getAlert`, `setAlertActive`,
`deleteAlert`, `activeAlerts`, `recordAlertCheck`). Both the PostgreSQL and in-memory implementations
sit behind the existing account-store contract test.

## Domain (`packages/domain`, pure)

```ts
type AlertDecision = 'notify' | 'skip' | 'expire';

decideAlert({
  threshold: number,              // ₹X
  lastNotifiedAmount: number | null,
  currentTotal: number,
  startDate: ISODate,
  today: ISODate,
}): AlertDecision
```

- `startDate < today` → `expire`.
- `currentTotal < threshold` and (`lastNotifiedAmount` is null or `currentTotal < lastNotifiedAmount`) →
  `notify`.
- Otherwise `skip`.

`suggestAlertThreshold(total)` gives 5% below the total, rounded down to ₹100. The UI uses it as the
default value.

## Mock price drift (`packages/providers`)

`mockDailyPrice` gets a `today: ISODate` argument (from the injected clock, as an India date) and
multiplies by a daily drift factor `0.96 + 0.08 × draw(destination|key|date|today)`. The factor is the
same for the same day and different on another day. Mock hotel and transport providers pass their clock's
date. Tests already pin the clock with `fixedClock`; expected amounts that change are updated once.

## Checker (`apps/api/src/worker/`)

`PriceAlertChecker.runOnce(now)`:

1. Load every active alert with its trip and user (`activeAlerts`).
2. For each alert, run the search again from the trip's saved inputs (no stored search needed). If the
   inputs no longer validate (month passed), treat it as `expire`.
3. Work out the plan total with the existing cost builder (`buildPlanCost`) for the saved plan and
   start date.
4. Call `decideAlert`.
   - `notify` → send the email, then save `lastNotifiedAt` and `lastNotifiedAmount`.
   - `expire` → set `active = false`.
5. Save `lastCheckedAt` for every alert it checked.

A failing alert (provider error, mail error) is logged and skipped; the others still run. A mail failure
does not save `lastNotifiedAmount`, so the next run tries again.

`PriceAlertScheduler` (Nest provider, only when `REDIS_URL` is set) registers a BullMQ job scheduler
`price-alerts` with cron `0 7 * * *`, time zone `Asia/Kolkata`, and a worker that calls `runOnce`.
Redis ensures one run per day even with several API instances. It closes the queue and worker on
shutdown.

New dependency: `bullmq` in `apps/api`.

## API (`/api/me/alerts`, signed in, same origin checks as saved trips)

| Method | Path | Body | Result |
|---|---|---|---|
| `POST` | `/api/me/alerts` | `{ tripId, threshold }` | Create or update the trip's alert. 400 `alert.threshold` unless `0 < threshold < today's total`. 404 if the trip isn't the user's. |
| `GET` | `/api/me/alerts` | — | The user's alerts: trip id and title, threshold, active, lastCheckedAt, lastNotifiedAmount. |
| `PATCH` | `/api/me/alerts/:id` | `{ active }` | Pause or resume. |
| `DELETE` | `/api/me/alerts/:id` | — | 204. |
| `POST` | `/api/dev/alerts/run` | — | Runs the checker now. Only registered when `NODE_ENV !== 'production'`. |

Bodies are validated with zod. Error messages are i18n keys.

## Email

Sent through the existing `Mailer` (SMTP, or the API log in development), in the user's saved locale
(en / hi / bn).

- Subject: "Your Goa trip is now ₹38,400" (Indian digit grouping).
- Body: plan and dates, group total and per person, "below your ₹40,000 alert", "approx. · prices checked
  at 07:00", a link that opens the saved trip, and a "stop this alert" link to `/account`.

## Web

- **Results page share bar:** a "Price alert" button next to "Save trip".
  - Not signed in → sign-in, then back to the same plan.
  - Trip not saved yet → setting the alert saves it first.
  - The form suggests `suggestAlertThreshold(total)`, can be edited, and shows today's total.
- **`/account`:** each saved trip shows its alert (₹X, active or paused, last checked, last emailed) with
  Pause/Resume and Delete.
- en / hi / bn strings for all of the above.

## Testing

- Domain: `decideAlert` (each branch, equal-to-threshold is `skip`, further drop notifies again) and
  `suggestAlertThreshold`.
- Providers: drift — same day gives the same price, a different day gives a different price, always
  within ±4% of the undrifted price.
- API: checker with the in-memory store, a fake mailer and `fixedClock` — notify, no repeat for the same
  price, notify again on a further drop, expire after the start date, one failing trip skipped, mail
  failure retried next run. Alerts endpoints with supertest (auth, ownership, threshold validation).
- Account store contract test covers the new alert methods.
- Web: the en/hi/bn render test covers the alert form and the `/account` alert row.

## Out of scope

Real price providers, SMS or WhatsApp alerts, alerts on other dates in the month, per-person thresholds,
and a price-history chart.
