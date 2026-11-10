import {
  addDays,
  dayOfWeek,
  daysInMonth,
  isoDate,
  priceForGroup,
  type ISODate,
  type Travellers,
} from '@tripsaver/domain';
import { indiaDate, type Clock } from '../clock.js';
import { buildDeepLink, SITE_NAMES, type SiteId } from '../deeplinks/index.js';
import type {
  FareGridQuery,
  RouteQuery,
  TrainProvider,
  TransportOffer,
  TransportProvider,
} from '../interfaces.js';
import { MOCK_CLIMATE, MOCK_EVENTS } from './data/calendar.js';
import { MOCK_ORIGINS, mockPlaceDirectory } from './data/places.js';
import { ROUTES, type RouteTemplate } from './data/routes.js';
import { mockDailyPrice } from './pricing-model.js';
import { draw } from './rng.js';

type TransportMode = 'train' | 'bus' | 'flight';

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h! * 60 + m!;
}

function hhmm(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Airline child fares (mock): under 2 flat ₹1,500, 2–11 at 75%, 12+ full. */
function airlineChildPrices(adult: number, t: Travellers): Record<number, number> {
  const out: Record<number, number> = {};
  for (const age of t.childAges) out[age] = age < 2 ? 1500 : age <= 11 ? Math.round(adult * 0.75) : adult;
  return out;
}

function availability(key: string): { availability: string; confirmChancePct: number } {
  const r = draw(key);
  if (r < 0.55) return { availability: `AVL ${Math.ceil(r * 120)}`, confirmChancePct: 95 };
  if (r < 0.8) return { availability: `RAC ${Math.ceil(r * 20)}`, confirmChancePct: 70 };
  return { availability: `WL ${Math.ceil(r * 60)}`, confirmChancePct: 25 };
}

abstract class MockTransport implements TransportProvider {
  abstract id: string;
  abstract name: string;
  abstract mode: TransportMode;
  protected abstract site: SiteId;

  constructor(protected clock: Clock) {}

  /** Fare for one adult on this date. Trains: fixed fares; buses and flights: seasonal. */
  protected adultFare(t: RouteTemplate, classCode: string, base: number, date: ISODate): number {
    // The holiday end of the route sets the season; big cities are both starting points and destinations,
    // so prefer the end that isn't a starting city (Goa → Delhi is priced by Goa's season).
    const isTrip = (c: string) => !!MOCK_EVENTS[c] && !MOCK_ORIGINS.some((o) => o.code === c);
    const destination = isTrip(t.to) ? t.to : isTrip(t.from) ? t.from : MOCK_EVENTS[t.to] ? t.to : t.from;
    return mockDailyPrice({
      base,
      date,
      destination,
      key: `${t.id}|${classCode}`,
      events: MOCK_EVENTS[destination] ?? [],
      climate: MOCK_CLIMATE[destination] ?? [],
      today: indiaDate(this.clock()),
    });
  }

  protected groupPrice(adult: number, travellers: Travellers) {
    return priceForGroup({ mode: this.mode, providerId: this.id, adultUnitPrice: adult, travellers });
  }

  async search(q: RouteQuery): Promise<TransportOffer[]> {
    const from = mockPlaceDirectory.get(q.from);
    const to = mockPlaceDirectory.get(q.to);
    if (!from || !to) return [];
    const link = buildDeepLink(this.site, {
      kind: this.mode,
      fromName: from.name,
      toName: to.name,
      fromCode: from.code,
      toCode: to.code,
      date: q.date,
      travellers: q.travellers,
    });
    const fetchedAt = this.clock().toISOString();
    const people = q.travellers.adults + q.travellers.childAges.length;
    const weekday = dayOfWeek(q.date);

    const offers: TransportOffer[] = [];
    for (const t of ROUTES) {
      if (t.mode !== this.mode || t.from !== q.from || t.to !== q.to || !t.daysOfWeek.includes(weekday))
        continue;
      const depart = minutes(t.departAt);
      const arriveDate = addDays(q.date, Math.floor((depart + t.durationMin) / 1440));
      for (const c of t.classes) {
        const adult = this.adultFare(t, c.code, c.baseAdultFare, q.date);
        const g = this.groupPrice(adult, q.travellers);
        offers.push({
          source: this.id,
          sourceName: SITE_NAMES[this.site],
          price: { amount: g.total, currency: 'INR' },
          perPerson: { amount: Math.round(g.total / people), currency: 'INR' },
          breakdown: g.lines,
          isEstimate: g.isEstimate,
          fetchedAt,
          bookingUrl: link.url,
          prefilled: link.prefilled,
          mode: this.mode,
          operator: t.operator,
          number: t.number,
          travelClass: c.code,
          departAt: `${q.date}T${t.departAt}`,
          arriveAt: `${arriveDate}T${hhmm(depart + t.durationMin)}`,
          departDate: q.date,
          arriveDate,
          durationMin: t.durationMin,
          fromPoint: t.fromPoint,
          toPoint: t.toPoint,
          ...(this.mode === 'train' ? availability(`${t.id}|${c.code}|${q.date}`) : {}),
        });
      }
    }
    return offers.sort((a, b) => a.price.amount - b.price.amount);
  }

  async cheapestByDate(q: FareGridQuery): Promise<Record<ISODate, TransportOffer | undefined>> {
    const out: Record<ISODate, TransportOffer | undefined> = {};
    for (let day = 1; day <= daysInMonth(q.year, q.month); day++) {
      const date = isoDate(q.year, q.month, day);
      const offers = await this.search({ from: q.from, to: q.to, date, travellers: q.travellers });
      out[date] = offers.find((o) => !q.classes || q.classes.includes(o.travelClass));
    }
    return out;
  }
}

export class MockTrainProvider extends MockTransport implements TrainProvider {
  id = 'mock-train';
  name = 'Sample trains';
  mode = 'train' as const;
  protected site: SiteId = 'irctc';

  /** Indian Railways fares are fixed per class; only availability varies by date. */
  protected override adultFare(_t: RouteTemplate, _c: string, base: number): number {
    return base;
  }

  bookingWindow() {
    return { advanceDays: 60, tatkalAcOpens: '10:00', tatkalNonAcOpens: '11:00' };
  }
}

export class MockBusProvider extends MockTransport {
  id = 'mock-bus';
  name = 'Sample buses';
  mode = 'bus' as const;
  protected site: SiteId = 'redbus';
}

export class MockFlightProvider extends MockTransport {
  id = 'mock-flight';
  name = 'Sample flights';
  mode = 'flight' as const;
  protected site: SiteId = 'makemytrip';

  protected override groupPrice(adult: number, travellers: Travellers) {
    return priceForGroup({
      mode: 'flight',
      providerId: this.id,
      adultUnitPrice: adult,
      travellers,
      providerChildPrices: airlineChildPrices(adult, travellers),
    });
  }
}
