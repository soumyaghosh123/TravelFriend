import { makeSearchInputSchema, type ValidSearchInput } from '@tripsaver/domain';
import { describe, expect, test } from 'vitest';
import type { TripStyle } from '../src/assemble.js';
import { fixedClock } from '../src/clock.js';
import { buildDatesSection } from '../src/dates-section.js';
import { buildHotelsSection } from '../src/hotels-section.js';
import { buildItinerarySection } from '../src/itinerary-section.js';
import { MockAttractionsProvider } from '../src/mock/attractions.js';
import { MOCK_DESTINATIONS } from '../src/mock/data/places.js';
import { createRegistry } from '../src/registry.js';
import type { ItinerarySection } from '../src/results-contract.js';

const clock = fixedClock('2026-11-08T06:00:00Z');
const set = createRegistry({}, clock);
const opts = { clock, timeoutMs: 4000 };
const STYLES: TripStyle[] = ['offbeat', 'budget', 'comfort'];

function search(to: string, days: number): ValidSearchInput {
  return makeSearchInputSchema('2026-11-08').parse({
    from: to === 'KOL' ? 'DEL' : 'KOL',
    to,
    days,
    month: '2026-12',
    hotelTypes: ['3-star', '4-star', '5-star'],
    travellers: { adults: 2, childAges: [3, 6] },
  });
}

async function plan(to: string, days: number, style: TripStyle): Promise<ItinerarySection> {
  const input = search(to, days);
  const dates = await buildDatesSection(set, input, { today: '2026-11-08', ...opts });
  const w = dates.styles.find((s) => s.style === style)!.top[0]!;
  const hotels = await buildHotelsSection(
    set,
    { to, checkIn: w.onward.arriveDate, checkOut: w.return.departDate, travellers: input.travellers },
    opts,
  );
  return buildItinerarySection(set, input, style, w, hotels, opts);
}

describe('every destination × plan × trip length builds a valid day-by-day plan', () => {
  for (const to of MOCK_DESTINATIONS.map((d) => d.code)) {
    for (const days of [4, 10]) {
      test.each(STYLES)(`${to}, ${days} days, %s`, async (style) => {
        const p = await plan(to, days, style);
        expect(p.available).toBe(true);
        if (!p.available) return;
        expect(p.days).toHaveLength(days);
        for (const d of p.days) {
          expect(d.activeMin).toBeLessThanOrEqual(540);
          expect(d.spend.total).toBe(d.spend.entry + d.spend.local + d.spend.meals);
        }
        expect(p.bases.reduce((n, b) => n + b.nights, 0)).toBe(p.checks.nightsAtBases);
        expect(['travel', 'arrival', 'departure']).toContain(p.checks.first.kind);
        expect(['travel', 'departure']).toContain(p.checks.last.kind);
      });
    }
  }
});

describe('Goa, 10 days (brief §12)', () => {
  test('offbeat plan visits the offbeat spots (Divar, Netravali, Cabo de Rama) and stays in a homestay', async () => {
    const p = await plan('GOA', 10, 'offbeat');
    if (!p.available) throw new Error('expected a plan');
    const visited = p.days.flatMap((d) => d.stops.map((s) => s.attractionId)).filter(Boolean);
    for (const id of ['goa-divar', 'goa-netravali', 'goa-cabo'])
      expect(visited.concat(p.unscheduled)).toContain(id);
    expect(visited.filter((id) => p.attractions[id!]!.isOffbeat).length).toBeGreaterThanOrEqual(2);
    expect(p.bases).toHaveLength(1); // Goa: one base, day trips
    expect(p.bases[0]!.hotel?.type).toBe('homestay');
    expect(p.bases[0]!.fiveStar?.stars).toBe(5);
  });

  test('budget plan: one base, the priced plan hotel, a free day, Mapusa on a Friday if it is scheduled', async () => {
    const p = await plan('GOA', 10, 'budget');
    if (!p.available) throw new Error('expected a plan');
    expect(p.checks.freeDay).not.toBeNull();
    // Single base: exactly the hotel the plan priced (its price is approx. only because children are on the booking).
    expect(p.bases).toHaveLength(1);
    expect(p.bases[0]!.hotelTotal).toBe(p.bases[0]!.hotel!.totalPrice);
    const mapusa = p.days.find((d) => d.stops.some((s) => s.attractionId === 'goa-mapusa'));
    if (mapusa) expect(new Date(`${mapusa.date}T00:00:00Z`).getUTCDay()).toBe(5);
    expect(p.arrivalPoint).toMatch(/Madgaon|Goa airport/);
    // The single base is where the booked hotel is, so days start and end there.
    expect(p.bases[0]!.lat).toBe(p.bases[0]!.hotel!.lat);
    expect(p.bases[0]!.lng).toBe(p.bases[0]!.hotel!.lng);
  });
});

describe('regions split into bases', () => {
  test('Kerala, 10 days: two bases far apart, ≥ 2 nights each, a transfer day between them', async () => {
    const p = await plan('KERALA', 10, 'budget');
    if (!p.available) throw new Error('expected a plan');
    expect(p.bases.length).toBeGreaterThanOrEqual(2);
    for (const b of p.bases) expect(b.nights).toBeGreaterThanOrEqual(2);
    expect(p.days.some((d) => d.kind === 'transfer')).toBe(true);
    for (const b of p.bases) expect(b.hotelTotalIsEstimate).toBe(true); // split stay: per night × nights
  });
});

describe('offbeat with no offbeat places', () => {
  test('says so and suggests the nearest offbeat spot elsewhere', async () => {
    const noOffbeat = new MockAttractionsProvider();
    const original = noOffbeat.attractions.bind(noOffbeat);
    noOffbeat.attractions = async (d) => (await original(d)).filter((a) => d !== 'JAIPUR' || !a.isOffbeat);
    const s2 = { ...set, attractions: [noOffbeat] };
    const input = search('JAIPUR', 6);
    const dates = await buildDatesSection(s2, input, { today: '2026-11-08', ...opts });
    const w = dates.styles.find((s) => s.style === 'offbeat')!.top[0]!;
    const p = await buildItinerarySection(s2, input, 'offbeat', w, null, opts);
    expect(p).toMatchObject({ available: false, reason: 'noOffbeat' });
    if (p.available) return;
    expect(p.nearestAlternative?.distanceKm).toBeGreaterThan(0);
    expect(p.nearestAlternative?.destination).not.toBe('JAIPUR');
  });
});

describe('local transport (brief §3.3)', () => {
  test('Goa budget: every journey has priced options, the plan uses a bus where one exists, extras for Divar/Dudhsagar', async () => {
    const p = await plan('GOA', 10, 'budget');
    if (!p.available) throw new Error('expected a plan');
    const { legs, tips, total } = p.local;
    expect(legs.map((l) => l.kind)).toContain('arrival');
    expect(legs.map((l) => l.kind)).toContain('departure');
    for (const l of legs) {
      expect(l.options.length).toBeGreaterThan(0);
      for (const o of l.options) {
        expect(o.max).toBeGreaterThanOrEqual(o.min);
        expect(o.booking.where).toBeTruthy();
      }
      expect(l.options.filter((o) => o.inPlan)).toHaveLength(1);
      expect(l.options.filter((o) => o.cheapest)).toHaveLength(1);
      if (l.options.some((o) => o.public)) expect(l.options.find((o) => o.inPlan)!.public).toBe(true);
    }
    expect(tips.join(' ')).toMatch(/Uber and Ola/);
    expect(total.min).toBe(legs.reduce((s, l) => s + l.plan.min, 0));
    // Taxi for the day covers 80 km; longer days pay ₹20 per extra km (± the 10% spread).
    for (const l of legs.filter((l) => l.kind === 'day')) {
      const taxi = l.options.find((o) => o.id === 'taxi-day');
      if (!taxi) continue;
      const mid = Math.round((taxi.min + taxi.max) / 2);
      if (l.km <= 80) expect(mid).toBeCloseTo(2800, -1);
      else expect(mid).toBeGreaterThan(2800 + (l.km - 81) * 20 - 20);
    }
    expect(legs.some((l) => l.kind === 'day' && l.km > 80)).toBe(true);
    const divarDay = legs.find((l) => l.stops.includes('Divar Island village walk'));
    if (divarDay) expect(divarDay.extras.map((e) => e.id)).toContain('divar-ferry');
  });

  test('day spends use the plan local-transport numbers, so the two tabs agree', async () => {
    const p = await plan('GOA', 10, 'comfort');
    if (!p.available) throw new Error('expected a plan');
    for (const d of p.days) {
      const legs = p.local.legs.filter((l) => l.dayIndex === d.index);
      expect(d.spend.local).toBe(legs.reduce((s, l) => s + Math.round((l.plan.min + l.plan.max) / 2), 0));
      expect(d.spend.total).toBe(d.spend.entry + d.spend.local + d.spend.meals);
    }
    // Comfort uses door-to-door options.
    for (const l of p.local.legs) expect(l.options.find((o) => o.inPlan)!.doorToDoor).toBe(true);
  });
});
