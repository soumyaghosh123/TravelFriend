# Milestone 1 – Foundation, Pricing & Cheapest-Dates Engines, Mock Providers – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pnpm/Turborepo monorepo whose `packages/domain` computes group prices (child rules) and the cheapest date windows in a month, fed by `packages/providers` mock train/bus/flight/hotel/calendar/climate providers for 5 destinations. Every part is unit-tested, and an integration test reproduces the brief's Kolkata → Goa, December 2026 example.

**Architecture:** Pure, deterministic engines in `packages/domain` (no I/O). Provider interfaces, a registry and seeded mock adapters in `packages/providers`, which depends on `domain` types only. No web, API or DB in this milestone. Those are Milestones 2+ (search API + Prisma, then web UI per the approved mockup).

**Tech Stack:** Node 24, pnpm 9, Turborepo 2, TypeScript 5 (strict), Vitest 2, ESLint 9 (flat config) + Prettier.

**Spec:** [docs/PLAN.md](../../PLAN.md) (sections 1, 5, 6.1, 6.2, 10, 12 steps 0–1, 3-engine). Brief: [BRIEF.md](../../../BRIEF.md).

**Out of scope here (later milestones):** Prisma/Postgres and docker-compose (Docker is not installed on this machine, so we ask before Milestone 2). Places/content/local-transport mocks (with the itinerary milestone). NestJS API, Next.js web.

## Global Constraints

- TypeScript `strict: true`, `noUncheckedIndexedAccess: true`; ESM (`"type": "module"`) in every package.
- Money = integer rupees, `Money { amount: number; currency: 'INR' }`; rounding with `Math.round` at each line item.
- Dates inside the domain are ISO `YYYY-MM-DD` strings (`ISODate`), calendar dates only. No `Date` timezone arithmetic (use UTC methods inside `dates.ts` only).
- Default child rules (PLAN §1 rule 2, A3): age 0–3 → `free` (×0), 4–7 → `half` (×0.5), ≥ 8 → `full` (×1). A provider's own child price overrides the rule, and that line is `isEstimate: false`.
- Hotel nights = nights actually at the destination (PLAN A1). The trip must fit inside the chosen month (A2).
- Every `PricedOffer` carries `source`, `sourceName`, `price`, `fetchedAt`, `bookingUrl`, `prefilled`, `isEstimate` (PLAN §5.1, rule 1).
- `packages/domain` must not import from `packages/providers` or perform I/O.
- Mock data is deterministic: same inputs → same outputs (seeded PRNG, no `Math.random`, no `Date.now()` except `fetchedAt` via an injectable clock).
- No secrets in code; `.env.example` committed.
- Commit after each task; add a line to `CHANGELOG.md` under `## Unreleased`.

## Review Focus

1. **Trip longer than the month** (e.g. 31 days in February, or `days` < 2): the engine returns a clear `RangeError`, not an empty or garbage calendar. Test in Task 4.
2. **A start date with no onward service** (a train that doesn't run that day): the window is skipped (`feasible: false`), never counted as ₹0 and ranked cheapest. Test in Task 4.
3. **Fewer than 3 windows satisfy the 3-day gap**, or costs tie: `topWindows` returns fewer items, with no duplicates and a stable order (earlier start wins ties). Test in Task 4.
4. **Age boundaries and bad head counts**: ages 3/4/7/8 land in the right band; `adults = 0`, negative or non-integer ages, or age > 17 as a "child" throw `RangeError`. Test in Task 3.
5. **Sites that cannot pre-fill** (IRCTC has no public pre-fill URL): the deep link returns `prefilled: false` instead of pretending, so the UI can show "enter these details on IRCTC". Test in Task 7.

---

## File Structure

```
package.json                     root scripts: dev, build, test, lint, typecheck, format
pnpm-workspace.yaml              apps/*, packages/*
turbo.json                       pipelines: build, test, lint, typecheck
tsconfig.base.json               strict shared compiler options
eslint.config.js · .prettierrc   lint/format
.env.example · CHANGELOG.md · .gitignore (append node_modules, dist, .turbo, .env)
packages/domain/
  package.json · tsconfig.json · vitest.config.ts
  src/index.ts                   re-exports
  src/types.ts                   ISODate, Money, Mode, FareType, Travellers, PricingRule, TravellerPriceLine, GroupPrice, PricedOffer, CalendarEvent, MonthClimate
  src/dates.ts                   date helpers
  src/pricing/rules.ts           DEFAULT_PRICING_RULES, fareTypeForAge
  src/pricing/group-price.ts     priceForGroup
  src/pricing/rooms.ts           suggestRooms
  src/dates-engine/windows.ts    computeWindows, assignBands
  src/dates-engine/top.ts        topWindows
  src/dates-engine/explain.ts    explainWindow, compareMonths
  test/*.test.ts                 one file per src module
packages/providers/
  package.json · tsconfig.json · vitest.config.ts
  src/index.ts
  src/interfaces.ts              provider interfaces + query/result types
  src/registry.ts                createRegistry
  src/clock.ts                   Clock type, systemClock, fixedClock
  src/deeplinks/index.ts         buildDeepLink
  src/mock/rng.ts                mulberry32, hashSeed
  src/mock/pricing-model.ts      mockDailyPrice (seasonality)
  src/mock/data/places.ts        origins + 5 destinations (codes, stations, airports, hubs)
  src/mock/data/calendar.ts      CalendarEvent[] + MonthClimate[] per destination
  src/mock/data/hotels.ts        hotel catalogue per destination
  src/mock/data/routes.ts        train/bus/flight route templates
  src/mock/transport.ts          MockTrainProvider, MockBusProvider, MockFlightProvider
  src/mock/hotels.ts             MockHotelProvider
  src/mock/calendar.ts           MockCalendarEventsProvider, MockWeatherProvider
  test/*.test.ts                 contract + unit tests
  test/goa-december.int.test.ts  brief §12 integration test
```

---

### Task 1: Monorepo scaffold

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `eslint.config.js`, `.prettierrc`, `.env.example`, `CHANGELOG.md`
- Create: `packages/domain/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`, `packages/providers/{package.json,tsconfig.json,vitest.config.ts,src/index.ts}`
- Modify: `.gitignore` (append `node_modules/`, `dist/`, `.turbo/`, `.env`, `coverage/`)
- Test: `packages/domain/test/smoke.test.ts`

**Interfaces:**
- Produces: workspace packages `@tripsaver/domain` and `@tripsaver/providers` (providers depends on `"@tripsaver/domain": "workspace:*"`). Root scripts `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` run through turbo.

- [ ] **Step 1: Install pnpm** — `corepack enable && corepack prepare pnpm@9 --activate`. If corepack is unavailable: `npm i -g pnpm@9`. Verify `pnpm -v` prints `9.x`.
- [ ] **Step 2: Create the root config files.** Root `package.json` is `"private": true`, with `"packageManager": "pnpm@9.x"` and devDependencies `turbo`, `typescript`, `vitest`, `eslint`, `typescript-eslint`, `prettier`. `tsconfig.base.json` sets `target ES2022`, `module NodeNext`, `strict`, `noUncheckedIndexedAccess`, `declaration`, `outDir dist`. `.env.example` has `TRAIN_PROVIDERS=mock`, `BUS_PROVIDERS=mock`, `FLIGHT_PROVIDERS=mock`, `HOTEL_PROVIDERS=mock`, `CALENDAR_PROVIDERS=mock`, `WEATHER_PROVIDERS=mock`, each with a comment.
- [ ] **Step 3: Create the two package skeletons** with `build: tsc -p .`, `test: vitest run`, `typecheck: tsc --noEmit`, `lint: eslint src test`.
- [ ] **Step 4: Write the smoke test** `packages/domain/test/smoke.test.ts`: `expect(1 + 1).toBe(2)`.
- [ ] **Step 5: Run** `pnpm install && pnpm test && pnpm typecheck && pnpm lint`. Expected: all succeed, 1 test passing.
- [ ] **Step 6: Commit** — `chore: scaffold pnpm/turbo monorepo with domain and providers packages`. Add a CHANGELOG line.

---

### Task 2: Domain types and date helpers

**Files:**
- Create: `packages/domain/src/types.ts`, `packages/domain/src/dates.ts`
- Test: `packages/domain/test/dates.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type ISODate = string;                       // 'YYYY-MM-DD'
  export interface Money { amount: number; currency: 'INR' }
  export type Mode = 'train' | 'bus' | 'flight' | 'hotel';
  export type FareType = 'free' | 'half' | 'full';
  export interface Travellers { adults: number; childAges: number[]; rooms?: number }
  export interface PricingRule { mode: Mode; providerId: string | null; minAge: number; maxAge: number | null; multiplier: number; fareType: FareType }
  export interface TravellerPriceLine { label: string; count: number; fareType: FareType; unitAmount: number; amount: number; isEstimate: boolean }
  export interface GroupPrice { total: number; lines: TravellerPriceLine[]; isEstimate: boolean }
  export interface PricedOffer { source: string; sourceName: string; price: Money; perPerson?: Money; breakdown?: TravellerPriceLine[]; isEstimate: boolean; fetchedAt: string; bookingUrl: string; prefilled: boolean }
  export type EventKind = 'festival' | 'holiday' | 'longWeekend' | 'school' | 'season' | 'local';
  export interface CalendarEvent { name: string; start: ISODate; end: ISODate; kind: EventKind; priceImpact: number } // 1.0 = no change
  export interface MonthClimate { month: number; priceIndex: number; maxC: number; minC: number; summary: string } // priceIndex 1.0 = yearly average
  ```
- Produces (`dates.ts`): `daysInMonth(year: number, month: number): number`, `isoDate(year, month, day): ISODate`, `addDays(d: ISODate, n: number): ISODate`, `diffDays(a: ISODate, b: ISODate): number` (b − a), `eachDay(from: ISODate, toInclusive: ISODate): ISODate[]`, `dayOfWeek(d: ISODate): 0..6` (0 = Sunday), `isWeekendNight(d: ISODate): boolean` (Fri or Sat).

- [ ] **Step 1: Write failing tests** in `dates.test.ts`:
  - `daysInMonth(2026, 12) === 31`, `daysInMonth(2026, 2) === 28`, `daysInMonth(2028, 2) === 29`
  - `addDays('2026-12-31', 1) === '2027-01-01'`, `addDays('2028-02-28', 1) === '2028-02-29'`
  - `diffDays('2026-12-01', '2026-12-10') === 9`
  - `eachDay('2026-12-30', '2027-01-02')` has length 4
  - `dayOfWeek('2026-12-01') === 2` (Tuesday)
  - `isWeekendNight('2026-12-04') === true` (Fri), `isWeekendNight('2026-12-06') === false` (Sun)
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/domain test`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `types.ts` and `dates.ts` (UTC `Date` methods only, inside `dates.ts`). Re-export from `src/index.ts`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): core types and calendar-date helpers`.

---

### Task 3: PricingEngine (child rules, group price, rooms)

**Files:**
- Create: `packages/domain/src/pricing/rules.ts`, `src/pricing/group-price.ts`, `src/pricing/rooms.ts`
- Test: `packages/domain/test/pricing.test.ts`

**Interfaces:**
- Consumes: Task 2 types.
- Produces:
  - `DEFAULT_PRICING_RULES: PricingRule[]`: for each mode in `train | bus | flight | hotel`, three rules with `providerId: null`: `{0,3,0,'free'}`, `{4,7,0.5,'half'}`, `{8,null,1,'full'}`.
  - `fareTypeForAge(age: number, mode: Mode, providerId: string, rules: PricingRule[]): PricingRule`. A provider-specific rule (matching `providerId`) beats the `null` default. Throws `RangeError` when no rule matches.
  - `validateTravellers(t: Travellers): void`. `RangeError` if `adults < 1`, if any child age is not an integer, or if an age is outside 0–17.
  - `priceForGroup(args: { mode: Mode; providerId: string; adultUnitPrice: number; travellers: Travellers; rules?: PricingRule[]; providerChildPrices?: Record<number, number> }): GroupPrice`.
    - Lines: one `Adult` line, then one line per child, labelled `Child (6 y)` or `Infant (3 y)` for free ones, in input order.
    - With `providerChildPrices[age]` present, that line uses the provider amount and `isEstimate: false`. Otherwise `unitAmount = Math.round(adultUnitPrice × multiplier)` and `isEstimate: true` for child lines.
    - Adult lines are `isEstimate: false`.
    - The group `isEstimate` is true if any line is an estimate.
  - `suggestRooms(t: Travellers): number` = `max(1, ceil(adults / 2), ceil((adults + count(childAges ≤ 7)) / 4))`. Children aged 8+ count as adults for this.

- [ ] **Step 1: Write failing tests:**
  - `fareTypeForAge(3,'train','irctc',DEFAULT_PRICING_RULES).fareType === 'free'`; age 4 → `'half'`; age 7 → `'half'`; age 8 → `'full'`.
  - A provider rule `{mode:'flight',providerId:'indigo',minAge:2,maxAge:11,multiplier:0.75,fareType:'half'}` makes age 3 on `'indigo'` return multiplier 0.75, while age 3 on `'spicejet'` returns `'free'`.
  - Brief example: `priceForGroup({mode:'train',providerId:'irctc',adultUnitPrice:2650,travellers:{adults:2,childAges:[3,6]}})`:
    - `.total === 6625`
    - `.lines.map(l => l.amount)` deep-equals `[5300, 0, 1325]` (adults, the 3-year-old, the 6-year-old, in input order)
    - `.isEstimate === true`
  - With `providerChildPrices: {6: 1500, 3: 0}`: total `6800`, and every line has `isEstimate === false`.
  - `validateTravellers({adults:0,childAges:[]})` throws `RangeError`. So do `childAges:[-1]`, `[2.5]` and `[18]`.
  - `suggestRooms({adults:2,childAges:[3,6]}) === 1`; `{adults:3,childAges:[]}` → 2; `{adults:2,childAges:[2,4,6]}` → 2; `{adults:2,childAges:[9,10]}` → 1.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the four functions in the files above. `priceForGroup` calls `validateTravellers` first.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): pricing engine with default child rules and provider overrides`.

---

### Task 4: CheapestDatesEngine — windows, bands, top 3

**Files:**
- Create: `packages/domain/src/dates-engine/windows.ts`, `src/dates-engine/top.ts`
- Test: `packages/domain/test/dates-engine.test.ts`

**Interfaces:**
- Consumes: `ISODate`, `daysInMonth`, `addDays`, `diffDays`, `eachDay`.
- Produces:
  ```ts
  export interface LegOption { departDate: ISODate; arriveDate: ISODate; groupFare: number; source: string }
  export interface CheapestDatesInput {
    year: number; month: number; days: number;
    onwardByDate: Record<ISODate, LegOption | undefined>;   // keyed by departDate, cheapest suitable option
    returnByDate: Record<ISODate, LegOption | undefined>;   // keyed by departDate
    nightlyGroupPrice: Record<ISODate, number | undefined>; // hotel cost for the night starting that date
    localPerDay: number;                                    // local transport + food + sights, group
  }
  export interface DateWindow {
    start: ISODate; end: ISODate; feasible: boolean;
    total: number; hotelNights: number; daysAtDestination: number;
    breakdown: { onward: number; return: number; hotel: number; local: number };
    band: 1 | 2 | 3 | 4 | 5 | null;              // null when infeasible
  }
  export function computeWindows(input: CheapestDatesInput): DateWindow[];
  export interface RankedWindow extends DateWindow { rank: number; savingVsMostExpensive: number }
  export function topWindows(windows: DateWindow[], count?: number /*3*/, minGapDays?: number /*3*/): RankedWindow[];
  ```
- Algorithm for start `s` (end `e = s + days − 1`), from PLAN §6.2:
  - `o = onwardByDate[s]`. If it is missing, the window is infeasible.
  - `a = o.arriveDate`.
  - `r` = the **latest** `d` in `[a, e]` with `returnByDate[d]` defined and `returnByDate[d].arriveDate ≤ e`. If there is none, the window is infeasible.
  - `hotel = Σ nightlyGroupPrice[n]` for `n` in `[a, r − 1]`. A missing night price makes the window infeasible.
  - `hotelNights = diffDays(a, r)`, `daysAtDestination = diffDays(a, r) + 1`, `local = localPerDay × daysAtDestination`.
  - `total = onward + return + hotel + local`.
  - Start dates run over the 1st … `daysInMonth − days + 1`.
  - Throw `RangeError` if `days < 2` or `days > daysInMonth`, or if `month` is not 1–12.
- Bands: sort the feasible windows by total ascending. A window at rank index `i` (ties share the rank of the first equal total) of `n` gets `band = min(5, 1 + floor(i × 5 / n))`.
- `topWindows`:
  - Walk the feasible windows by (total asc, start asc). Accept a window if its start is ≥ `minGapDays` away from every accepted start. Stop at `count`.
  - `savingVsMostExpensive = maxFeasibleTotal − total`.
  - `rank` is 1-based.

- [ ] **Step 1: Write failing tests** using a helper `flatInput(overrides)` that builds December 2026, `days: 10`, every onward/return option `{departDate:d, arriveDate:d, groupFare:1000}`, nightly price 500 every night, `localPerDay:100`:
  - `computeWindows(flatInput()).length === 22`, the first start is `'2026-12-01'` and the last is `'2026-12-22'`.
  - Flat case: every window has `hotelNights === 9`, `total === 1000 + 1000 + 4500 + 1000` = `7500`, and `band === 1`.
  - Slow-train case: onward arrives `addDays(d, 1)` and return arrives `addDays(d, 1)`. Window 1 → `a = '2026-12-02'`, `r = '2026-12-09'`, `hotelNights === 7`, `daysAtDestination === 8`.
  - No-service case: delete `onwardByDate['2026-12-05']` → the window starting on the 5th has `feasible === false` and `band === null`, and it is absent from `topWindows`.
  - Peak case: nightly price 2000 for nights 20–31 Dec. Then `topWindows(ws)` has length 3; its starts are pairwise ≥ 3 days apart; `[0].start === '2026-12-01'`; and `[0].savingVsMostExpensive === maxTotal − [0].total`.
  - Gap-limited case: a 30-day trip in a 31-day month gives 2 windows → `topWindows` length ≤ 2, with no duplicate starts.
  - Ties: with a flat input, `topWindows` starts are `['2026-12-01','2026-12-04','2026-12-07']`.
  - `computeWindows({...flatInput(), days: 1})` throws `RangeError`. So does `days: 29` with `month: 2, year: 2026` (Feb 2026 has 28 days), and so does `month: 13`.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** `computeWindows` (prefix sums are not required at this size; a direct sum is fine), `assignBands` (internal, in `windows.ts`) and `topWindows`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): cheapest-dates engine with price bands and top-3 windows`.

---

### Task 5: Explaining dates and comparing months

**Files:**
- Create: `packages/domain/src/dates-engine/explain.ts`
- Test: `packages/domain/test/explain.test.ts`

**Interfaces:**
- Consumes: `DateWindow`, `CalendarEvent`, `MonthClimate`, `eachDay`, `isWeekendNight`.
- Produces:
  ```ts
  export interface WindowReason { kind: EventKind | 'weekend'; text: string }
  export function explainWindow(w: DateWindow, events: CalendarEvent[]): WindowReason[];
  export interface MonthComparison { month: number; label: 'cheap' | 'normal' | 'peak'; priceIndex: number; maxC: number; minC: number; summary: string }
  export function compareMonths(climate: MonthClimate[], chosenMonth: number): { months: MonthComparison[]; bestAlternative: { month: number; savingPct: number } | null };
  ```
- Rules:
  - `explainWindow` returns every event overlapping `[start, end]` with `priceImpact > 1`, sorted by priceImpact descending, with text `"<name> (<d1>–<d2> <Mon>)"`. Counting nights `[start, end − 1]`, if the window includes ≥ 2 Fri/Sat nights, it appends `{kind:'weekend', text:'Includes <k> Friday/Saturday nights'}`.
  - Labels: `priceIndex < 0.85` → `cheap`, `> 1.15` → `peak`, otherwise `normal`.
  - `bestAlternative` is the month (≠ chosen) with the lowest `priceIndex`, and only if it is ≥ 10% cheaper than the chosen month. `savingPct = round((1 − alt/chosen) × 100)`.

- [ ] **Step 1: Write failing tests:**
  - Event `{name:'Christmas–New Year peak',start:'2026-12-20',end:'2026-12-31',kind:'season',priceImpact:1.8}`. A window 22–31 Dec → the first reason has `kind === 'season'` and text `'Christmas–New Year peak (20–31 Dec)'`. A window 1–10 Dec → no `season` reason.
  - An event with `priceImpact: 1.0` is never returned.
  - The 1–10 Dec 2026 window (nights 1–9 Dec) includes Fri 4 and Sat 5 → it has a weekend reason with text `'Includes 2 Friday/Saturday nights'`. A 2-day window 6–7 Dec (night of Sun 6) → no weekend reason.
  - `compareMonths` with a fixture where every month has `priceIndex 1.3` except Dec `1.4` and Jan `1.05`: Dec label `'peak'`, `bestAlternative` deep-equals `{ month: 1, savingPct: 25 }`.
  - When every month is within 10% of the chosen month → `bestAlternative === null`.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** `explain.ts` and export it.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(domain): explain expensive dates and compare months`.

---

### Task 6: Provider interfaces, clock, registry

**Files:**
- Create: `packages/providers/src/interfaces.ts`, `src/clock.ts`, `src/registry.ts`
- Test: `packages/providers/test/registry.test.ts`

**Interfaces:**
- Consumes: `@tripsaver/domain` types.
- Produces (`interfaces.ts`):
  ```ts
  export interface Place { code: string; name: string; kind: 'city' | 'region'; stations: string[]; airports: string[]; busPoints: string[]; lat: number; lng: number }
  export interface RouteQuery { from: string; to: string; date: ISODate; travellers: Travellers }      // from/to = Place.code
  export interface TransportOffer extends PricedOffer { mode: 'train' | 'bus' | 'flight'; operator: string; number?: string; travelClass: string; departAt: string; arriveAt: string; departDate: ISODate; arriveDate: ISODate; durationMin: number; availability?: string; confirmChancePct?: number; fromPoint: string; toPoint: string }
  export interface FareGridQuery { from: string; to: string; year: number; month: number; travellers: Travellers; classes?: string[] }
  export interface TransportProvider { id: string; name: string; mode: 'train' | 'bus' | 'flight'; search(q: RouteQuery): Promise<TransportOffer[]>; cheapestByDate(q: FareGridQuery): Promise<Record<ISODate, TransportOffer | undefined>> }
  export interface TrainProvider extends TransportProvider { mode: 'train'; bookingWindow(): { advanceDays: number; tatkalAcOpens: string; tatkalNonAcOpens: string } }
  export type BusProvider = TransportProvider & { mode: 'bus' };
  export type FlightProvider = TransportProvider & { mode: 'flight' };
  export interface HotelQuery { destination: string; checkIn: ISODate; checkOut: ISODate; travellers: Travellers; types?: HotelType[] }
  export type HotelType = 'budget' | '3star' | '4star' | '5star' | 'homestay' | 'resort' | 'hostel';
  export interface HotelSitePrice extends PricedOffer { site: string }
  export interface HotelOffer { hotelId: string; name: string; type: HotelType; stars: number; guestRating: number; reviewCount: number; lat: number; lng: number; amenities: string[]; breakfastIncluded: boolean; freeCancellation: boolean; nights: number; sitePrices: HotelSitePrice[]; cheapest: HotelSitePrice }
  export interface HotelProvider { id: string; name: string; search(q: HotelQuery): Promise<HotelOffer[]>; nightlyGroupPrice(destination: string, year: number, month: number, travellers: Travellers, type: HotelType): Promise<Record<ISODate, number>> }
  export interface CalendarEventsProvider { id: string; events(destination: string, year: number, month: number): Promise<CalendarEvent[]> }
  export interface WeatherProvider { id: string; climate(destination: string): Promise<MonthClimate[]> }
  export interface PlaceDirectory { places(): Place[]; get(code: string): Place | undefined }
  export interface ProviderSet { train: TrainProvider[]; bus: BusProvider[]; flight: FlightProvider[]; hotel: HotelProvider[]; calendar: CalendarEventsProvider[]; weather: WeatherProvider[]; places: PlaceDirectory }
  ```
- Produces (`clock.ts`): `type Clock = () => Date`, `systemClock`, `fixedClock(iso: string): Clock`.
- Produces (`registry.ts`): `createRegistry(env: Record<string, string | undefined>, clock?: Clock): ProviderSet`. Reads `TRAIN_PROVIDERS`, `BUS_PROVIDERS`, `FLIGHT_PROVIDERS`, `HOTEL_PROVIDERS`, `CALENDAR_PROVIDERS`, `WEATHER_PROVIDERS` (comma lists; missing → `'mock'`). An unknown id throws `Error('Unknown provider "x" in HOTEL_PROVIDERS')`. In this milestone the factory map only knows `mock`. It is wired to Tasks 8–10, so add each entry as its task lands; until then the registry test uses stub factories passed via an optional third parameter `factories?: Partial<Factories>`.

- [ ] **Step 1: Write failing tests:**
  - `createRegistry({}, fixedClock('2026-11-08T10:00:00Z'), stubFactories)` returns one provider per mode, with ids from the stubs.
  - `createRegistry({HOTEL_PROVIDERS:'mock,agoda'}, …)` throws `/Unknown provider "agoda" in HOTEL_PROVIDERS/`.
  - Whitespace and empty entries are ignored: `' mock , '` → 1 provider.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** `interfaces.ts`, `clock.ts`, `registry.ts`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(providers): provider interfaces, clock and registry`.

---

### Task 7: Deep-link builders

**Files:**
- Create: `packages/providers/src/deeplinks/index.ts`
- Test: `packages/providers/test/deeplinks.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type SiteId = 'irctc' | 'redbus' | 'makemytrip' | 'goibibo' | 'booking' | 'agoda' | 'expedia';
  export interface DeepLinkParams { kind: 'hotel' | 'train' | 'bus' | 'flight'; fromName?: string; toName?: string; fromCode?: string; toCode?: string; destinationName?: string; date?: ISODate; checkIn?: ISODate; checkOut?: ISODate; travellers: Travellers; rooms?: number }
  export function buildDeepLink(site: SiteId, p: DeepLinkParams): { url: string; prefilled: boolean };
  ```
- URL formats (all values URL-encoded):
  - `booking`: `https://www.booking.com/searchresults.html?ss=<dest>&checkin=<ci>&checkout=<co>&group_adults=<a>&group_children=<c>&no_rooms=<r>` plus one `&age=<n>` per child. `prefilled: true`.
  - `agoda`: `https://www.agoda.com/search?textToSearch=<dest>&checkIn=<ci>&los=<nights>&adults=<a>&children=<c>&childages=<comma ages>&rooms=<r>`. `prefilled: true`.
  - `expedia`: `https://www.expedia.co.in/Hotel-Search?destination=<dest>&startDate=<ci>&endDate=<co>&adults=<a>&children=<1_age,1_age…>`. `prefilled: true`.
  - `makemytrip` / `goibibo` hotel and flight: the site's search page with destination and dates as query params. `prefilled: true` for hotels and `false` for flights. The flight URL formats are not publicly stable, so mark them false until verified.
  - `redbus`: `https://www.redbus.in/bus-tickets/<from-slug>-to-<to-slug>?doj=<DD-Mon-YYYY>`. `prefilled: true` (date only; the traveller count is chosen on seat selection).
  - `irctc`: `https://www.irctc.co.in/nget/train-search`. `prefilled: false`.
  - If `rooms` is unset, use `suggestRooms(travellers)`. Throw `Error` when a required param for the kind is missing (hotel: destinationName, checkIn, checkOut; transport: fromName, toName, date).

- [ ] **Step 1: Write failing tests:**
  - Booking, Goa, `2026-12-02` → `2026-12-09`, 2 adults + `[3,6]`: the URL contains `checkin=2026-12-02`, `checkout=2026-12-09`, `group_adults=2`, `group_children=2`, `age=3`, `age=6`, `no_rooms=1`; `prefilled === true`.
  - Agoda, same inputs: contains `los=7` and `childages=3%2C6`.
  - redBus, Kolkata → Goa, `2026-12-01`: contains `/bus-tickets/kolkata-to-goa` and `doj=01-Dec-2026`.
  - IRCTC → `prefilled === false`.
  - Booking without `checkOut` throws.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** `buildDeepLink`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(providers): deep-link builders with prefilled flag`.

---

### Task 8: Mock data foundation — places, PRNG, seasonal pricing model, calendar & climate

**Files:**
- Create: `packages/providers/src/mock/rng.ts`, `src/mock/pricing-model.ts`, `src/mock/data/places.ts`, `src/mock/data/calendar.ts`, `src/mock/calendar.ts`
- Test: `packages/providers/test/mock-foundation.test.ts`

**Interfaces:**
- Produces:
  - `hashSeed(key: string): number`; `mulberry32(seed: number): () => number` (values in [0, 1)).
  - `mockDailyPrice(args: { base: number; date: ISODate; destination: string; key: string; events: CalendarEvent[]; climate: MonthClimate[]; weekendUplift?: number /*1.15*/ }): number`.
    - Formula: `round(base × climate[month].priceIndex × (isWeekendNight ? uplift : 1) × max(priceImpact of events covering date, 1) × (0.95 + 0.1 × rng))`.
    - The rng is seeded by `hashSeed(key + date)`.
  - `MOCK_PLACES: Place[]`:
    - origins `KOL` (Kolkata: HWH, SDAH; CCU), `DEL`, `BOM`, `BLR`, `MAA`, `HYD`
    - destinations `GOA` (region: MAO, VSG, THVM; GOI, GOX), `MANALI` (city; nearest rail CDG/Kalka; KUU), `JAIPUR` (JP; JAI), `KERALA` (region: ERS, TVC; COK, TRV), `DARJEELING` (city; NJP; IXB)
    - `mockPlaceDirectory: PlaceDirectory`
  - `MOCK_EVENTS: Record<string, CalendarEvent[]>`. Goa at least:
    - Christmas–New Year peak 2026-12-20..2026-12-31, ×1.8
    - Goa Liberation Day 2026-12-19, ×1.2
    - Feast of St Francis Xavier 2026-12-03, ×1.15
    - Diwali 2026-11-08, ×1.3 (applies to every destination)
    - Each other destination gets ≥ 2 events in Dec 2026–Mar 2027.
  - `MOCK_CLIMATE: Record<string, MonthClimate[]>`: 12 months per destination. Goa: Dec index 1.4, Jan 1.05, Jun–Sep ≤ 0.7.
  - `MockCalendarEventsProvider` (id `'mock-calendar'`) and `MockWeatherProvider` (id `'mock-weather'`) implement the Task 6 interfaces. Register them under `mock` in the registry.

- [ ] **Step 1: Write failing tests:**
  - `mulberry32(42)` gives the same first 3 values on two calls; all values are in [0, 1).
  - `mockDailyPrice` is deterministic for the same args. For Goa with base 1000: the mean over 21–30 Dec is > 1.5 × the mean over 1–10 Dec.
  - `mockPlaceDirectory.get('GOA')?.kind === 'region'`, and every destination has ≥ 1 airport or station.
  - `MockCalendarEventsProvider.events('GOA', 2026, 12)` contains an event named `/Christmas/`. `MockWeatherProvider.climate('GOA')` has length 12.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the files listed above.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(providers): mock places, seasonal pricing model, calendar and climate`.

---

### Task 9: Mock transport providers (train, bus, flight)

**Files:**
- Create: `packages/providers/src/mock/data/routes.ts`, `src/mock/transport.ts`
- Modify: `src/registry.ts` (register `mock` train/bus/flight)
- Test: `packages/providers/test/mock-transport.test.ts`

**Interfaces:**
- Consumes: `priceForGroup` (domain), `mockDailyPrice`, `buildDeepLink`, `Clock`, `MOCK_PLACES`, `MOCK_EVENTS`, `MOCK_CLIMATE`.
- Produces:
  - `MockTrainProvider` (id `'mock-train'`, booking via `irctc`), `MockBusProvider` (`'mock-bus'`, `redbus`), `MockFlightProvider` (`'mock-flight'`, `makemytrip`). Each is a class with constructor `(clock: Clock)`.
  - `ROUTES` templates: for every origin × destination pair, 0–3 trains, 0–3 buses and 1–3 flights.
    - Each template has `daysOfWeek: number[]`, `departAt`, `durationMin`, `classes: { code: string; baseAdultFare: number }[]`.
    - Kolkata → Goa must include a train with `daysOfWeek` excluding at least one weekday. Trains of about 34 h arrive the next day.
    - **No bus** template for Kolkata → Goa (> 2,000 km).
  - Train `bookingWindow()` returns `{ advanceDays: 60, tatkalAcOpens: '10:00', tatkalNonAcOpens: '11:00' }`.
- Rules:
  - `search` returns offers only for templates running on `dayOfWeek(date)`.
  - Group price = `priceForGroup({ mode, providerId: id, adultUnitPrice: mockDailyPrice(...), travellers })`.
  - Flights pass `providerChildPrices` for every child (mock airline: under 2 → 1500 flat, 2–11 → 75% of adult). Flight offers are therefore `isEstimate: false`.
  - `fetchedAt = clock().toISOString()`.
  - `bookingUrl`/`prefilled` come from `buildDeepLink`.
  - `cheapestByDate` returns, for each date of the month, the cheapest offer across classes allowed by `q.classes` (default: all).

- [ ] **Step 1: Write failing tests:**
  - Kolkata → Goa train search on `'2026-12-01'` (Tue) for 2 adults + `[3,6]`:
    - every offer has `source === 'mock-train'`, a non-empty `bookingUrl`, `prefilled === false` and `fetchedAt === '2026-11-08T10:00:00.000Z'` (fixed clock)
    - for a 3A offer with `f = breakdown[0].unitAmount`, the `breakdown` amounts are `[2f, 0, round(f/2)]` (adults, the 3-year-old, the 6-year-old)
    - `arriveDate > departDate`
  - Kolkata → Goa bus search returns `[]`.
  - The train's `cheapestByDate` over Dec 2026 has `undefined` on at least one date (a non-running day). The flight's has an offer on all 31 dates.
  - Flight offers: `isEstimate === false` and the child lines are not `'half'`-rule amounts (they equal 75% of the adult fare).
  - Contract test helper `expectPricedOffer(o)`: `price.amount ≥ 0`, `currency === 'INR'`, `source`, `sourceName`, `bookingUrl` and `fetchedAt` are all non-empty. Run it over every offer from all 3 providers for every origin × destination on `'2026-12-01'`.
  - Determinism: the same query twice → deep-equal results.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the routes data, the three providers, and their registry entries.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(providers): mock train, bus and flight providers with deterministic seasonal fares`.

---

### Task 10: Mock hotel provider with per-site price comparison

**Files:**
- Create: `packages/providers/src/mock/data/hotels.ts`, `src/mock/hotels.ts`
- Modify: `src/registry.ts` (register `mock` hotel)
- Test: `packages/providers/test/mock-hotels.test.ts`

**Interfaces:**
- Consumes: `mockDailyPrice`, `buildDeepLink`, `suggestRooms`, `Clock`, `eachDay`.
- Produces:
  - `MockHotelProvider` (id `'mock-hotels'`), constructor `(clock: Clock, catalogue: Record<string, MockHotel[]> = MOCK_HOTELS)`. `MockHotel` = `{ hotelId, name, type, stars, guestRating, reviewCount, lat, lng, amenities, breakfastIncluded, freeCancellation, baseRoomRate, sites: SiteId[] }`.
  - `MOCK_HOTELS`: at least 15 hotels per destination covering all 7 `HotelType`s. At least 3 are 5★ and at least 3 are rated below 3.5. Hotel names are fictional.
- Rules:
  - Nightly room price = `mockDailyPrice({ base: hotel.baseRoomRate, key: hotelId, … })` × rooms. Rooms = `travellers.rooms ?? suggestRooms(travellers)`.
  - Stay total = the sum over nights `[checkIn, checkOut − 1]`, × 1.12 for taxes, rounded.
  - Each hotel is listed on 3–4 sites from `['booking','agoda','makemytrip','goibibo','expedia']`. Each site's price is the stay total × a deterministic site factor in [0.97, 1.05].
  - `cheapest` = the lowest site price. Ties go to the earlier site in the list above.
  - Children under 8 are free for hotels by default (they share the bed). Extra-bed charges are out of scope for M1 and are noted in CHANGELOG.
  - `search` filters by `q.types` when given.
  - `nightlyGroupPrice(dest, y, m, travellers, type)` returns, for every night of the month, the cheapest nightly cost (incl. tax) among hotels of that `type` rated ≥ 3.5.

- [ ] **Step 1: Write failing tests:**
  - Goa search for `2026-12-02` → `2026-12-09` with 2 adults + `[3,6]`:
    - every offer has `nights === 7`, ≥ 3 `sitePrices`, and `cheapest.price.amount === min(sitePrices)`
    - every site price passes `expectPricedOffer` with `prefilled === true` and a URL containing `2026-12-02`
  - `types: ['5star']` returns only `stars === 5`.
  - `nightlyGroupPrice('GOA', 2026, 12, t, '3star')` has 31 keys, and the mean over 21–30 Dec is > 1.5 × the mean over 1–10 Dec.
  - Hotels rated below 3.5 never set a `nightlyGroupPrice` value. Check by making the only `3star` candidates in a stub catalogue rated 3.4: the result is `{}`.
- [ ] **Step 2: Run tests.** Expected: FAIL.
- [ ] **Step 3: Implement** the hotel data, the provider, and its registry entry.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** — `feat(providers): mock hotel provider with per-site price comparison`.

---

### Task 11: Brief §12 integration test — Kolkata → Goa, December 2026

**Files:**
- Create: `packages/providers/src/assemble.ts` (`buildCheapestDatesInput`)
- Test: `packages/providers/test/goa-december.int.test.ts`
- Modify: `CHANGELOG.md`, `CLAUDE.md` (fill in the real commands that now work)

**Interfaces:**
- Consumes: `createRegistry`, `computeWindows`, `topWindows`, `explainWindow`, `compareMonths`.
- Produces: `buildCheapestDatesInput(set: ProviderSet, args: { from: string; to: string; year: number; month: number; days: number; travellers: Travellers; style: 'budget' | 'comfort'; localPerDay: number }): Promise<CheapestDatesInput>`.
  - **budget:** onward and return use the cheapest of train classes `['SL','3A']`, buses, and flights. Hotels use type `'3star'` (the budget hotel list comes later). The nightly price is the cheapest across hotel providers.
  - **comfort:** flights or train classes `['2A','1A','3A']`, hotels `'4star'`.
  - Onward and return grids cover only dates inside the chosen month (A2), so a return never departs after the month's last day.
  - This lives in `providers` because it performs I/O. The Milestone 2 orchestrator will reuse it.

- [ ] **Step 1: Write the failing integration test.** Use `createRegistry({}, fixedClock('2026-11-08T10:00:00Z'))`, Kolkata → Goa, Dec 2026, 10 days, 2 adults + `[3,6]`, budget, `localPerDay: 1500`. Assert:
  - `computeWindows` gives 22 windows, and at least 18 are feasible.
  - `topWindows(ws)` has length 3; no top window starts on or after `'2026-12-20'`; the starts are pairwise ≥ 3 days apart.
  - The worst feasible window, explained with the Goa events, has a reason matching `/Christmas/`.
  - `compareMonths(climate, 12).months[11].label === 'peak'` and `bestAlternative !== null`.
  - For every feasible window: `breakdown.onward + breakdown.return + breakdown.hotel + breakdown.local === total`.
- [ ] **Step 2: Run** `pnpm --filter @tripsaver/providers test goa-december`. Expected: FAIL (`buildCheapestDatesInput` missing).
- [ ] **Step 3: Implement** `buildCheapestDatesInput`.
- [ ] **Step 4: Run the full suite** `pnpm test && pnpm typecheck && pnpm lint`. Expected: all pass.
- [ ] **Step 5: Commit** — `test: Kolkata→Goa December 2026 end-to-end cheapest-dates scenario`. Update CHANGELOG with the milestone summary.

---

## What comes next (separate plans, written after M1 is reviewed)

- **M2 — Search API:** NestJS app, `POST /search` + SSE stream, Redis cache, Prisma schema (needs Docker or a hosted Postgres/Redis; ask the user), the `/go` click-tracking redirect.
- **M3 — Web UI part 1:** Next.js app implementing the approved mockup: home, search form, results page shell, plan cards, Best dates tab.
- **M4 — Transport and hotel tabs**, then **M5 — PlanBuilder, BaseSplitter, ItineraryEngine, places/content mocks**, then **M6 — local transport, sights, food, shopping, do's & don'ts**, then **M7 — cost summary and checklist, PDF/share**, then **Phase 2**.
