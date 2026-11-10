import { daysInMonth, isoDate, priceForGroup, type ISODate, type Travellers } from '@tripsaver/domain';
import type { Clock } from '../clock.js';
import { aviasalesLink } from '../deeplinks/index.js';
import type {
  FareGridQuery,
  FlightProvider,
  PlaceDirectory,
  RouteQuery,
  TransportOffer,
} from '../interfaces.js';
import { mockPlaceDirectory } from '../mock/data/places.js';
import { parseTravelpayouts, type TpFare } from './travelpayouts-parse.js';

const HOUR_MS = 3600_000;
/** Cached fares are a few days old already; keep a route-month for 6 hours (decision 2026-11-10). */
const TTL_MS = 6 * HOUR_MS;
/** After a failure, no request for 5 minutes; sample flights meanwhile. */
const PAUSE_MS = 5 * 60_000;
const TIMEOUT_MS = 3500;

const AIRLINES: Record<string, string> = {
  '6E': 'IndiGo',
  AI: 'Air India',
  IX: 'Air India Express',
  QP: 'Akasa Air',
  SG: 'SpiceJet',
  UK: 'Vistara',
  I5: 'AirAsia India',
  '9I': 'Alliance Air',
  S5: 'Star Air',
  G8: 'Go First',
};

interface Fare extends TpFare {
  /** The airport codes we asked for (a city code like GOI covers GOX too); used in the booking link. */
  askedFrom: string;
  askedTo: string;
}

interface Month {
  fares: Fare[];
  fetchedAt: string;
}

export interface TravelpayoutsDeps {
  clock: Clock;
  token: string;
  /** Travelpayouts Partner ID: added to booking links so bookings are credited. */
  marker: string;
  /** Used for routes or months without data, and while Travelpayouts is failing. */
  fallback: FlightProvider;
  places?: PlaceDirectory;
  fetch?: typeof fetch;
  baseUrl?: string;
  ttlMs?: number;
  timeoutMs?: number;
}

/**
 * Real flight fares from the Travelpayouts (Aviasales) Flight Data API: prices travellers found in the
 * last few days, not live seats, so every price is "approx.". One request per airport pair per month
 * answers both the price calendar and single dates. A date without data has no flight (we don't mix in
 * sample fares, which could win "cheapest date"); a route-month with no data at all, or a failing API,
 * gets the sample flights, which carry their own "sample" source.
 */
export class TravelpayoutsFlightProvider implements FlightProvider {
  id = 'travelpayouts';
  name = 'Aviasales (Travelpayouts)';
  mode = 'flight' as const;
  private readonly cache = new Map<string, { at: number; p: Promise<Month> }>();
  private pausedUntil = 0;

  constructor(private readonly deps: TravelpayoutsDeps) {}

  async search(q: RouteQuery): Promise<TransportOffer[]> {
    const month = await this.month(q.from, q.to, q.date.slice(0, 7));
    if (!month) return this.deps.fallback.search(q);
    return month.fares
      .filter((f) => f.date === q.date)
      .map((f) => this.offer(f, q.travellers, month.fetchedAt))
      .sort((a, b) => a.price.amount - b.price.amount);
  }

  async cheapestByDate(q: FareGridQuery): Promise<Record<ISODate, TransportOffer | undefined>> {
    const ym = `${q.year}-${String(q.month).padStart(2, '0')}`;
    const month = await this.month(q.from, q.to, ym);
    if (!month) return this.deps.fallback.cheapestByDate(q);
    const economy = !q.classes || q.classes.includes('Economy');
    const out: Record<ISODate, TransportOffer | undefined> = {};
    for (let day = 1; day <= daysInMonth(q.year, q.month); day++) {
      const date = isoDate(q.year, q.month, day);
      const best = economy
        ? month.fares
            .filter((f) => f.date === date)
            .reduce<Fare | undefined>((b, f) => (!b || f.price < b.price ? f : b), undefined)
        : undefined;
      out[date] = best && this.offer(best, q.travellers, month.fetchedAt);
    }
    return out;
  }

  /** The route-month's fares, or null when the sample flights should be used instead. */
  private async month(from: string, to: string, ym: string): Promise<Month | null> {
    const places = this.deps.places ?? mockPlaceDirectory;
    const a = places.get(from)?.airports ?? [];
    const b = places.get(to)?.airports ?? [];
    if (!a.length || !b.length) return null;
    const now = this.deps.clock().getTime();
    const key = `${from}|${to}|${ym}`;
    let hit = this.cache.get(key);
    if (!hit || now - hit.at >= (this.deps.ttlMs ?? TTL_MS)) {
      if (now < this.pausedUntil) return null;
      const p = this.load(a, b, ym);
      hit = { at: now, p };
      this.cache.set(key, hit);
      p.catch(() => {
        this.pausedUntil = this.deps.clock().getTime() + PAUSE_MS;
        if (this.cache.get(key)?.p === p) this.cache.delete(key);
      });
    }
    try {
      const m = await hit.p;
      return m.fares.length ? m : null;
    } catch {
      return null;
    }
  }

  private async load(from: string[], to: string[], ym: string): Promise<Month> {
    const pairs = from.flatMap((o) => to.map((d) => [o, d] as const));
    const lists = await Promise.all(pairs.map(([o, d]) => this.request(o, d, ym)));
    const seen = new Set<string>();
    const fares: Fare[] = [];
    for (const f of lists.flat().sort((x, y) => x.price - y.price)) {
      const id = `${f.airline}|${f.flightNumber ?? f.price}|${f.departAt}`;
      if (seen.has(id)) continue;
      seen.add(id);
      fares.push(f);
    }
    return { fares, fetchedAt: this.deps.clock().toISOString() };
  }

  private async request(origin: string, destination: string, ym: string): Promise<Fare[]> {
    const url = new URL('/aviasales/v3/prices_for_dates', this.deps.baseUrl ?? 'https://api.travelpayouts.com');
    for (const [k, v] of Object.entries({
      origin,
      destination,
      departure_at: ym,
      one_way: 'true',
      direct: 'false',
      currency: 'inr',
      sorting: 'price',
      limit: '1000',
    }))
      url.searchParams.set(k, v);
    const res = await (this.deps.fetch ?? fetch)(url.toString(), {
      headers: { 'X-Access-Token': this.deps.token, Accept: 'application/json' },
      signal: AbortSignal.timeout(this.deps.timeoutMs ?? TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Travelpayouts ${res.status}`);
    return parseTravelpayouts(await res.json()).map((f) => ({ ...f, askedFrom: origin, askedTo: destination }));
  }

  private offer(f: Fare, travellers: Travellers, fetchedAt: string): TransportOffer {
    const g = priceForGroup({ mode: 'flight', providerId: this.id, adultUnitPrice: f.price, travellers });
    const people = travellers.adults + travellers.childAges.length;
    const airline = AIRLINES[f.airline] ?? f.airline;
    const stops = f.transfers > 0 ? ` (${f.transfers} stop${f.transfers > 1 ? 's' : ''})` : '';
    return {
      source: this.id,
      sourceName: 'Aviasales',
      price: { amount: g.total, currency: 'INR' },
      perPerson: { amount: Math.round(g.total / people), currency: 'INR' },
      breakdown: g.lines,
      // Fares found by other travellers in the last few days: always approximate.
      isEstimate: true,
      fetchedAt,
      bookingUrl: aviasalesLink({
        from: f.askedFrom,
        to: f.askedTo,
        date: f.date,
        travellers,
        marker: this.deps.marker,
      }),
      prefilled: true,
      mode: 'flight',
      operator: `${airline}${stops}`,
      ...(f.flightNumber ? { number: `${f.airline} ${f.flightNumber}` } : {}),
      travelClass: 'Economy',
      departAt: f.departAt,
      arriveAt: f.arriveAt,
      departDate: f.date,
      arriveDate: f.arriveDate,
      durationMin: f.durationMin,
      fromPoint: f.originAirport,
      toPoint: f.destinationAirport,
    };
  }
}
