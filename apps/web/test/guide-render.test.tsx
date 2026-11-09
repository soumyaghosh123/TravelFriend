import {
  buildGuideSection,
  createRegistry,
  fixedClock,
  MOCK_DESTINATIONS,
  type GuideSection,
} from '@tripsaver/providers';
import { NextIntlClientProvider } from 'next-intl';
import { readFileSync } from 'node:fs';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { beforeAll, describe, expect, test } from 'vitest';
import { GuidePanel, type GuideTab } from '../components/guide-panel';

// PLAN §12 step 8, done when: "Content renders for all 5 destinations" (guide pages use GuidePanel too).
const clock = fixedClock('2026-11-08T06:00:00Z');
const codes = MOCK_DESTINATIONS.map((d) => d.code);
const tabs: GuideTab[] = ['sights', 'food', 'shopping', 'dos'];
const guides: Record<string, GuideSection> = {};

beforeAll(async () => {
  const set = createRegistry({}, clock);
  for (const c of codes) guides[c] = await buildGuideSection(set, c, { clock, timeoutMs: 4000 });
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

describe('guide tabs render for every destination, in every language', () => {
  const cases = codes.flatMap((c) =>
    tabs.flatMap((tab) => ['en', 'hi', 'bn'].map((locale) => [c, tab, locale] as const)),
  );
  test.each(cases)('%s · %s · %s', (code, tab, locale) => {
    const { html, errors } = render(locale, <GuidePanel tab={tab} guide={guides[code]!} style="budget" />);
    expect(errors).toEqual([]);
    expect(html.length).toBeGreaterThan(1500);
  });
});

describe('guide content (en)', () => {
  test('Goa sights: near the main area vs day trips, fees, filters, official notes', () => {
    const { html } = render('en', <GuidePanel tab="sights" guide={guides.GOA!} style="budget" />);
    for (const s of [
      'Within 10 km of Calangute Beach',
      'Day trips',
      'Fort Aguada',
      'Dudhsagar Falls jeep safari',
      'Must-see',
      'Kid-friendly',
      'Free',
      'approx.',
    ])
      expect(html).toContain(s);
    expect(html).not.toContain('Nightlife'); // no nightlife sights in the data → no empty filter chip
  });

  test('Jaipur sights link to official tickets', () => {
    expect(render('en', <GuidePanel tab="sights" guide={guides.JAIPUR!} style="budget" />).html).toContain(
      'https://obms-tourist.rajasthan.gov.in/',
    );
  });

  test('Goa food: dishes with veg tags and price ranges, where to eat for the plan, sample places', () => {
    const { html } = render('en', <GuidePanel tab="food" guide={guides.GOA!} style="budget" />);
    for (const s of [
      'Goa dishes to try',
      'Fish curry rice',
      'Non-veg',
      'Contains egg',
      'Try it at',
      'Budget plan: street food',
      'for two',
      '(sample)',
    ])
      expect(html).toContain(s);
    expect(html).toMatch(/₹150(<!-- -->)?–(<!-- -->)?₹250/);
  });

  test('vegetarian travellers: only veg dishes and no non-veg-only places', () => {
    const { html } = render('en', <GuidePanel tab="food" guide={guides.GOA!} style="budget" food="veg" />);
    expect(html).not.toContain('Fish curry rice');
    expect(html).not.toContain('Seafood restaurant (sample)');
    expect(html).toContain('Pure-veg places first');
  });

  test('Goa shopping: markets with bargaining advice, fair-price shops, traps; trip dates show market days', () => {
    // 1–10 Dec 2026: Wednesday 2 and 9, Friday 4, Saturday 5.
    const { html } = render(
      'en',
      <GuidePanel
        tab="shopping"
        guide={guides.GOA!}
        style="budget"
        trip={{ start: '2026-12-01', end: '2026-12-10' }}
      />,
    );
    for (const s of [
      'Mapusa Friday Market',
      'Bargain hard: start at 50',
      'Fair-price shops',
      'Government emporium · fixed fair price',
      'Tourist trap:',
      'Closed Sun',
    ])
      expect(html).toContain(s);
    expect(html).toMatch(/On your trip: Fri,? 4 Dec/);
    expect(html).toMatch(/On your trip: Wed,? 2 Dec, Wed,? 9 Dec/);
    // Shops open most days don't list every date of the trip.
    expect(html).not.toMatch(/On your trip: Tue,? 1 Dec/);
  });

  test('Manali do’s & don’ts: permits, emergency numbers, nearest hospital, packing', () => {
    const climate = { month: 12, priceIndex: 1, maxC: 10, minC: -2, summary: 'Cold, chance of snow' };
    const { html } = render(
      'en',
      <GuidePanel tab="dos" guide={guides.MANALI!} style="budget" climate={climate} />,
    );
    for (const s of [
      'Rohtang Pass',
      'tel:112',
      'Nearest hospital: Civil Hospital, Manali',
      'Nearest police station',
      'Thermals',
      'about 10° by day',
    ])
      expect(html).toContain(s);
    expect(html).toContain('last checked by our team on 2 Nov 2026');
  });

  test('no content provider → sights still show, other tabs explain', () => {
    const bare = { ...guides.GOA!, guide: null };
    expect(render('en', <GuidePanel tab="sights" guide={bare} style="budget" />).html).toContain(
      'Fort Aguada',
    );
    expect(render('en', <GuidePanel tab="food" guide={bare} style="budget" />).html).toContain(
      'don’t have food, shopping and safety notes',
    );
  });
});
