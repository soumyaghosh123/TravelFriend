import { makeSearchInputSchema } from '@tripsaver/domain';
import {
  buildDatesSection,
  buildHotelsSection,
  buildTransportSection,
  createRegistry,
  fixedClock,
  type DatesSection,
  type HotelsSection,
  type TransportSection,
} from '@tripsaver/providers';
import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, test } from 'vitest';
import { BestDatesTab } from '../components/best-dates-tab';
import { DestinationBanner } from '../components/destination-banner';
import { GettingThereTab } from '../components/getting-there-tab';
import { HotelsTab } from '../components/hotels-tab';
import { PlanCards } from '../components/plan-cards';
import { ResultTabs } from '../components/result-tabs';

// Real data from the mock providers: brief §12, Kolkata → Goa, 10 days, Dec 2026, 2 adults + kids 3 and 6.
const clock = fixedClock('2026-11-08T06:00:00Z');
let dates: DatesSection;
let transport: TransportSection;
let hotels: HotelsSection;

beforeAll(async () => {
  const input = makeSearchInputSchema('2026-11-08').parse({
    from: 'KOL',
    to: 'GOA',
    days: 10,
    month: '2026-12',
    hotelTypes: ['3-star'],
    travellers: { adults: 2, childAges: [3, 6] },
  });
  const set = createRegistry({}, clock);
  dates = await buildDatesSection(set, input, { today: '2026-11-08', clock, timeoutMs: 4000 });
  const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
  transport = await buildTransportSection(
    set,
    { from: 'KOL', to: 'GOA', onwardDate: top.onward.departDate, returnDate: top.return.departDate, tripEnd: top.end, travellers: input.travellers },
    { clock, timeoutMs: 4000 },
  );
  hotels = await buildHotelsSection(
    set,
    { to: 'GOA', checkIn: top.onward.arriveDate, checkOut: top.return.departDate, travellers: input.travellers, stayNear: 'Calangute' },
    { clock, timeoutMs: 4000 },
  );
});

function render(locale: string, node: ReactNode): { html: string; errors: string[] } {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  const errors: string[] = [];
  const html = renderToString(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Kolkata" onError={(e) => errors.push(e.message)}>
      {node}
    </NextIntlClientProvider>,
  );
  return { html, errors };
}

function page() {
  const budget = dates.styles.find((s) => s.style === 'budget')!;
  const top = budget.top[0]!;
  const selection = { status: 'ok' as const, window: top, reasons: top.reasons, rank: top.rank, saving: top.saving, retry: () => {} };
  return (
    <>
      <DestinationBanner code="GOA" name="Goa" kind="region" month="2026-12" climate={dates.climate} />
      <PlanCards styles={dates.styles} selected="budget" onSelect={() => {}} people={4} />
      <ResultTabs active="dates" />
      <BestDatesTab dates={dates} style={budget} people={4} selectedStart={top.start} selection={selection} onSelect={() => {}} />
    </>
  );
}

function gettingThere() {
  const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
  return <GettingThereTab transport={transport} window={top} style="budget" people={4} />;
}

describe('Getting there tab renders with real mock data', () => {
  test.each(['en', 'hi', 'bn'])('%s: no missing translations or render errors', (locale) => {
    const { html, errors } = render(locale, gettingThere());
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(3000);
  });

  test('en: summary cards, the plan’s train marked, fare breakdown, booking links, sample-data note', () => {
    const { html } = render('en', gettingThere());
    for (const s of ['Cheapest', 'Fastest', 'Best overnight option', 'In your Budget plan', 'chance of confirmation', 'child (3 yrs) free', 'sample data'])
      expect(html).toContain(s);
    expect(html).toMatch(/Book on IRCTC/);
    expect(html).toContain('Transport in your Budget plan, both ways');
  });
});

describe('results page renders with real mock data', () => {
  test.each(['en', 'hi', 'bn'])('%s: no missing translations or render errors', (locale) => {
    const { html, errors } = render(locale, page());
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(5000);
  });

  test('en: peak warning, cheapest windows, booking links and estimate labels are on the page', () => {
    const { html } = render('en', page());
    expect(html).toContain('December 2026 is peak season here.');
    expect(html).toContain('Christmas–New Year peak');
    expect(html).toContain('3 cheapest date windows');
    expect(html).toMatch(/Book on IRCTC/);
    expect(html).toContain('approx.');
    expect(html).toContain('built from');
    // Every booking link opens the partner site in a new tab, marked as sponsored.
    const links = [...html.matchAll(/<a [^>]*href="(https:[^"]+)"[^>]*>/g)];
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const [tag] of links) expect(tag).toContain('rel="noopener noreferrer sponsored"');
  });

  test('calendar has a button for each of the 22 possible start dates', () => {
    const { html } = render('en', page());
    expect(html.match(/aria-label="Start \d+ Dec: approx\./g)).toHaveLength(22);
  });
});

function hotelsTab() {
  const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
  return <HotelsTab section={hotels} window={top} style="budget" chosenTypes={['3-star', 'homestay']} />;
}

describe('Hotels tab renders with real mock data', () => {
  test.each(['en', 'hi', 'bn'])('%s: no missing translations or render errors', (locale) => {
    const { html, errors } = render(locale, hotelsTab());
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(5000);
  });

  test('en: the plan stay, both lists side by side, the extra list for chosen homestays, per-site prices with the cheapest marked', () => {
    const { html } = render('en', hotelsTab());
    for (const s of ['Budget plan stay', '3-star and above', '5-star', 'Also matching your hotel types', 'from Calangute Beach', 'Guest rating 3.5+', 'Restaurant · for two'])
      expect(html).toContain(s);
    expect(html).toMatch(/aria-label="Book on [^"]+ · cheapest site"/);
    const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
    expect(html).toContain(`checkin=${top.onward.arriveDate}`); // booking links carry the stay dates
  });
});
