import { makeSearchInputSchema } from '@tripsaver/domain';
import {
  buildDatesSection,
  buildGuideSection,
  buildPlanCost,
  buildHotelsSection,
  buildItinerarySection,
  buildTransportSection,
  createRegistry,
  fixedClock,
  type DatesSection,
  type PlanCostView,
  type GuideSection,
  type HotelsSection,
  type ItinerarySection,
  type TransportSection,
} from '@tripsaver/providers';
import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, test } from 'vitest';
import { BestDatesTab } from '../components/best-dates-tab';
import { CostTab } from '../components/cost-tab';
import { TripPrintout } from '../components/trip-printout';
import { TripShareBar } from '../components/trip-share-bar';
import { planCalendarEvents, shareUrl, whatsappUrl } from '../lib/trip-export';
import { buildIcs } from '@tripsaver/domain';
import { createTranslator } from 'next-intl';
import { DayPlanTab } from '../components/day-plan-tab';
import { DestinationBanner } from '../components/destination-banner';
import { GettingThereTab } from '../components/getting-there-tab';
import { GuidePanel } from '../components/guide-panel';
import { HotelsTab } from '../components/hotels-tab';
import { LocalTransportTab } from '../components/local-transport-tab';
import { PlanCards } from '../components/plan-cards';
import { ResultTabs } from '../components/result-tabs';

// Real data from the mock providers: brief §12, Kolkata → Goa, 10 days, Dec 2026, 2 adults + kids 3 and 6.
const clock = fixedClock('2026-11-08T06:00:00Z');
let dates: DatesSection;
let transport: TransportSection;
let hotels: HotelsSection;
let itinerary: ItinerarySection;
let guide: GuideSection;
let costs: PlanCostView[];

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
    {
      from: 'KOL',
      to: 'GOA',
      onwardDate: top.onward.departDate,
      returnDate: top.return.departDate,
      tripEnd: top.end,
      travellers: input.travellers,
    },
    { clock, timeoutMs: 4000 },
  );
  hotels = await buildHotelsSection(
    set,
    {
      to: 'GOA',
      checkIn: top.onward.arriveDate,
      checkOut: top.return.departDate,
      travellers: input.travellers,
      stayNear: 'Calangute',
    },
    { clock, timeoutMs: 4000 },
  );
  itinerary = await buildItinerarySection(set, input, 'budget', top, hotels, { clock, timeoutMs: 4000 });
  guide = await buildGuideSection(set, 'GOA', { clock, timeoutMs: 4000 });
  costs = await Promise.all(
    dates.styles.map((s) =>
      buildPlanCost(
        set,
        input,
        s.style,
        s.top[0]!,
        { clock, timeoutMs: 4000 },
        s.style === 'budget' ? hotels : undefined,
      ),
    ),
  );
});

function render(locale: string, node: ReactNode): { html: string; errors: string[] } {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'));
  const errors: string[] = [];
  const html = renderToString(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="Asia/Kolkata"
      onError={(e) => errors.push(e.message)}
    >
      {node}
    </NextIntlClientProvider>,
  );
  return { html, errors };
}

function page() {
  const budget = dates.styles.find((s) => s.style === 'budget')!;
  const top = budget.top[0]!;
  const selection = {
    status: 'ok' as const,
    window: top,
    reasons: top.reasons,
    rank: top.rank,
    saving: top.saving,
    retry: () => {},
  };
  return (
    <>
      <DestinationBanner code="GOA" name="Goa" kind="region" month="2026-12" climate={dates.climate} />
      <PlanCards styles={dates.styles} selected="budget" onSelect={() => {}} people={4} />
      <ResultTabs active="dates" />
      <BestDatesTab
        dates={dates}
        style={budget}
        people={4}
        selectedStart={top.start}
        selection={selection}
        onSelect={() => {}}
      />
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
    for (const s of [
      'Cheapest',
      'Fastest',
      'Best overnight option',
      'In your Budget plan',
      'chance of confirmation',
      'child (3 yrs) free',
      'sample data',
    ])
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
    for (const s of [
      'Budget plan stay',
      '3-star and above',
      '5-star',
      'Also matching your hotel types',
      'from Calangute Beach',
      'Guest rating 3.5+',
      'Restaurant · for two',
    ])
      expect(html).toContain(s);
    expect(html).toMatch(/aria-label="Book on [^"]+ · cheapest site"/);
    const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
    expect(html).toContain(`checkin=${top.onward.arriveDate}`); // booking links carry the stay dates
  });
});

function dayPlan() {
  const top = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
  return <DayPlanTab plan={itinerary} window={top} transport={transport} onPickPlan={() => {}} />;
}

describe('Day-by-day tab renders with real mock data', () => {
  test.each(['en', 'hi', 'bn'])('%s: no missing translations or render errors', (locale) => {
    const { html, errors } = render(locale, dayPlan());
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(8000);
  });

  test('en: 10 days with slots, a free day, the hotel for each night with a booking link, and the rule checks', () => {
    const { html } = render('en', dayPlan());
    for (let n = 1; n <= 10; n++) expect(html).toContain(`Day ${n}<`);
    for (const s of [
      'Morning',
      'Afternoon',
      'Evening',
      'Free day',
      'Tonight:',
      'How this plan was checked',
      'No day has more than 9 active hours',
      'Hotel nights: ',
    ])
      expect(html).toContain(s);
    expect(html).toMatch(/aria-label="Book on [^"]+"/);
  });

  test('plan cards: Offbeat, Budget and Comfort all have totals', () => {
    const { html } = render('en', page());
    for (const s of ['Offbeat', 'Budget', 'Comfort']) expect(html).toContain(s);
    expect(dates.styles.map((s) => s.style)).toEqual(['offbeat', 'budget', 'comfort']);
    expect(html).not.toContain('0★');
  });
});

describe('Local transport tab renders with real mock data', () => {
  const tab = () => {
    if (!itinerary.available) throw new Error('expected a plan');
    return <LocalTransportTab local={itinerary.local} plan="Budget" sampleData={itinerary.sampleData} />;
  };

  test.each(['en', 'hi', 'bn'])('%s: no missing translations or render errors', (locale) => {
    const { html, errors } = render(locale, tab());
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(3000);
  });

  test('en: each journey with options, fare ranges, where to book, and the Goa tip', () => {
    const { html } = render('en', tab());
    for (const s of [
      'Cheapest',
      'Most convenient',
      'In your Budget plan',
      'Kadamba bus',
      'GoaMiles',
      'Prepaid taxi',
      'Uber and Ola',
      'Local transport in your Budget plan',
    ])
      expect(html).toContain(s);
    expect(html).toMatch(/₹[\d,]+(<!-- -->)?–(<!-- -->)?₹[\d,]+/);
  });

  test('en: each fare says where it comes from (Kadamba: 2019 notification; others: sample)', () => {
    const { html } = render('en', tab());
    expect(html).toContain('Fare source: Goa bus fare notification');
    expect(html).toContain('thegoan.net');
    expect(html).toContain('Sample fare, not yet checked against an official tariff');
  });
});

describe('Guide tabs with the Budget plan (Goa)', () => {
  test('distances from the plan hotel, sights the plan visits marked, food at the hotel', () => {
    if (!itinerary.available) throw new Error('expected a plan');
    const hotel = itinerary.bases[0]!.hotel!;
    const sights = render(
      'en',
      <GuidePanel tab="sights" guide={guide} plan={itinerary} style="budget" />,
    ).html;
    expect(sights).toContain(`Distances are by road from your hotel, ${hotel.name}`);
    expect(sights).toContain('In your plan');
    const food = render('en', <GuidePanel tab="food" guide={guide} plan={itinerary} style="budget" />).html;
    expect(food).toContain(`Food at your hotel, ${hotel.name}`);
    expect(food).toMatch(/Breakfast is (not )?included/);
  });
});

describe('Food tab with real places from OpenStreetMap (spec 2026-11-10-osm-restaurants)', () => {
  const msgs = (locale: string) =>
    JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8')).results.food;
  const near = (d: number) => ({ lat: guide.mainArea.lat + d, lng: guide.mainArea.lng });
  const live = (): GuideSection => ({
    ...guide,
    restaurants: {
      list: [
        {
          id: 'osm-node-1',
          name: 'Souza Lobo',
          kind: 'restaurant',
          vegType: 'unknown',
          live: true,
          cuisine: ['goan', 'seafood'],
          hours: 'Mo-Su 11:00-23:00',
          ...near(0.005),
        },
        {
          id: 'osm-node-2',
          name: 'Ritz Classic',
          kind: 'restaurant',
          vegType: 'both',
          live: true,
          area: '18th June Road, Panaji',
          ...near(0.01),
        },
      ],
      live: true,
      realProvider: true,
      source: {
        name: 'OpenStreetMap contributors',
        url: 'https://www.openstreetmap.org/copyright',
        licence: 'ODbL',
      },
      fetchedAt: '2026-11-08T05:00:00.000Z',
    },
  });

  for (const locale of ['en', 'hi', 'bn']) {
    test(`${locale}: real places with map links and OSM credit; no rating, no sample label, no "try it at"`, () => {
      const m = msgs(locale);
      const { html, errors } = render(
        locale,
        <GuidePanel tab="food" guide={live()} plan={itinerary} style="comfort" />,
      );
      expect(errors).toEqual([]);
      expect(html).toContain('Souza Lobo');
      expect(html).toContain(
        `https://www.google.com/maps/search/?api=1&amp;query=${near(0.005).lat},${near(0.005).lng}`,
      );
      expect(html).toContain(m.openInMaps);
      expect(html).toContain(m.osmCredit);
      expect(html).toContain(m.placeVeg.unknown);
      expect(html).toContain(m.typicalForTwo);
      expect(html).not.toContain('(sample)');
      expect(html).not.toContain('★');
      // The fixed words of "Try it at {place} · {km} km" in this language (placeholders removed).
      const tryAtWords = (m.tryAt as string)
        .split(/\{[^}]+\}/)
        .map((x) => x.trim())
        .find((x) => x.length > 2)!;
      expect(html).not.toContain(tryAtWords);
    });
  }

  test('a destination without a curated guide still lists the real places', () => {
    const { html, errors } = render(
      'en',
      <GuidePanel tab="food" guide={{ ...live(), guide: null }} plan={itinerary} style="budget" />,
    );
    expect(errors).toEqual([]);
    expect(html).toContain('Ritz Classic');
    expect(html).not.toContain(msgs('en').dishesTitle.split('{')[0].trim() || 'dishes to try');
  });

  test('veg traveller and only non-veg places nearby: says so instead of an empty list', () => {
    const g = live();
    g.restaurants.list = g.restaurants.list.map((r) => ({ ...r, vegType: 'non-veg' as const }));
    const { html } = render(
      'en',
      <GuidePanel tab="food" guide={g} plan={itinerary} style="budget" food="veg" />,
    );
    expect(html).toContain('find places to eat near');
  });

  test('sample places (mock): ratings stay; no "live list unavailable" note', () => {
    const { html } = render('en', <GuidePanel tab="food" guide={guide} plan={itinerary} style="budget" />);
    expect(html).toContain('★');
    expect(html).not.toContain(msgs('en').liveUnavailable);
  });

  test('real source switched on but it failed: says the live list is unavailable', () => {
    const g = { ...guide, restaurants: { ...guide.restaurants, realProvider: true } };
    const { html } = render('en', <GuidePanel tab="food" guide={g} plan={itinerary} style="budget" />);
    expect(html).toContain(msgs('en').liveUnavailable);
  });
});

describe('Total & book tab renders with real mock data', () => {
  const tab = () => (
    <CostTab
      searchId="s1"
      plans={costs}
      selected="budget"
      travellers="2 adults · 2 children"
      childAges={[3, 6]}
    />
  );

  test.each(['en', 'hi', 'bn'])('%s: no missing translations or render errors', (locale) => {
    const { html, errors } = render(locale, tab());
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(3000);
  });

  test('en: every plan with Comfort 4★ and 5★ columns, rows, child rule, checklist with booking links', () => {
    const { html } = render('en', tab());
    for (const s of [
      'Offbeat',
      'Budget',
      'Comfort 4★',
      'Comfort 5★',
      'Transport there and back',
      'Hotels (all nights)',
      'Shopping &amp; buffer',
      'Total for the group',
      'Per person (÷4)',
      'the 3-year-old travels free',
      'the 6-year-old pays half',
      'Book everything · Budget plan',
      '0 of ',
      'Onward train',
      'Return',
      'Mark as booked',
    ])
      expect(html).toContain(s);
    const budget = costs.find((c) => c.style === 'budget')!;
    if (!budget.available) throw new Error('expected a plan');
    expect(html).toContain('Hotel · ');
    expect(html).toContain(`₹${budget.cost.total.toLocaleString('en-IN')}`);
  });
});

describe('Export: PDF, share link, WhatsApp, calendar (step 10)', () => {
  const budget = () => {
    const w = dates.styles.find((s) => s.style === 'budget')!.top[0]!;
    const cost = costs.find((c) => c.style === 'budget')!;
    if (!itinerary.available || !cost.available) throw new Error('expected a plan');
    return { w, cost, plan: itinerary };
  };
  const printout = () => {
    const { w, cost, plan } = budget();
    return (
      <TripPrintout
        plan={plan}
        window={w}
        cost={cost}
        style="budget"
        fromName="Kolkata"
        toName="Goa"
        travellers="2 adults · 2 children"
      />
    );
  };

  test.each(['en', 'hi', 'bn'])('%s: printable plan has no missing translations', (locale) => {
    const { errors } = render(locale, printout());
    expect(errors).toEqual([]);
  });

  test('exported PDF matches the plan: every day, sight, hotel, journey, total and checklist item', () => {
    const { w, cost, plan } = budget();
    const html = render('en', printout()).html.replace(/<!-- -->/g, '');
    for (const d of plan.days) expect(html).toContain(`Day ${d.index} · `);
    const sights = plan.days.flatMap((d) =>
      d.stops.flatMap((s) =>
        s.kind === 'visit' && s.attractionId ? [plan.attractions[s.attractionId]!.name] : [],
      ),
    );
    expect(sights.length).toBeGreaterThan(0);
    for (const s of sights) expect(html).toContain(s.replace(/&/g, '&amp;'));
    for (const b of plan.bases) if (b.hotel) expect(html).toContain(b.hotel.name.replace(/&/g, '&amp;'));
    for (const o of [w.onward, w.return]) expect(html).toContain(o.number ?? o.operator);
    expect(html).toContain(`₹${cost.cost.total.toLocaleString('en-IN')}`);
    for (const p of ['transport', 'hotels', 'local', 'sights', 'food', 'buffer'] as const)
      expect(html).toContain(`₹${cost.cost[p].toLocaleString('en-IN')}`);
    expect((html.match(/☐/g) ?? []).length).toBe(cost.checklist.length);
    // Booking links printed in full, so they work on paper too.
    expect(html).toContain(w.onward.bookingUrl.replace(/&/g, '&amp;'));
  });

  test('calendar: one entry per day plus the journeys, with the same wording; a valid .ics', () => {
    const { w, plan } = budget();
    const messages = JSON.parse(readFileSync(new URL('../messages/en.json', import.meta.url), 'utf8'));
    const tr = {
      plan: createTranslator({ locale: 'en', messages, namespace: 'results.plan' }),
      results: createTranslator({ locale: 'en', messages, namespace: 'results' }),
    } as unknown as Parameters<typeof planCalendarEvents>[3];
    const events = planCalendarEvents(plan, w, 's1', tr);
    expect(events).toHaveLength(plan.days.length + 2);
    expect(events[0]).toMatchObject({
      start: w.onward.departAt.slice(0, 16),
      end: w.onward.arriveAt.slice(0, 16),
    });
    expect(events.at(-1)).toMatchObject({ start: w.return.departAt.slice(0, 16) });
    const day1 = events[1]!;
    expect(day1).toMatchObject({ date: plan.days[0]!.date, title: expect.stringMatching(/^Day 1 · /) });
    const ics = buildIcs('Goa', events, '2026-11-09T10:00:00Z');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(events.length);
    expect(new Set(events.map((e) => e.uid)).size).toBe(events.length);
  });

  test('share link reopens the same plan and dates; WhatsApp gets the message', () => {
    expect(shareUrl('https://tripsaver.test', 'abc', 'comfort', '2026-12-09')).toBe(
      'https://tripsaver.test/trip/abc?plan=comfort&start=2026-12-09',
    );
    const u = new URL(whatsappUrl('Goa trip: https://tripsaver.test/trip/abc'));
    expect(u.origin).toBe('https://wa.me');
    expect(u.searchParams.get('text')).toBe('Goa trip: https://tripsaver.test/trip/abc');
  });

  test.each(['en', 'hi', 'bn'])(
    '%s: share bar renders with PDF, WhatsApp and Google Calendar links',
    (locale) => {
      const { w, cost, plan } = budget();
      const { html, errors } = render(
        locale,
        <TripShareBar
          searchId="s1"
          style="budget"
          plan={plan}
          window={w}
          total={cost.cost.total}
          saved={{ status: 'unsaved' }}
          onSave={async () => 'ok'}
          ensureSaved={async () => 't1'}
          fromName="Kolkata"
          toName="Goa"
          people={4}
        />,
      );
      expect(errors).toEqual([]);
      expect(html).toContain(`/trip/s1/print?plan=budget&amp;start=${plan.start}&amp;autoprint=1`);
      expect(html).toContain('https://wa.me/?text=');
      expect(html).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
      const alertsMsgs = JSON.parse(
        readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), 'utf8'),
      ).alerts;
      expect(html).toContain(alertsMsgs.button);
    },
  );
});
