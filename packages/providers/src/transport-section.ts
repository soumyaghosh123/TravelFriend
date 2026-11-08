import {
  addDays,
  combineLegs,
  summarizeTransport,
  worthShowing,
  type ISODate,
  type TransportLike,
  type Travellers,
} from '@tripsaver/domain';
import type { Clock } from './clock.js';
import { withTimeout } from './dates-section.js';
import type { ProviderSet, TransportOffer, TransportProvider } from './interfaces.js';
import type { CombinedRoute, DirectionTransport, TransportSection, TransportService } from './results-contract.js';

const MODES: TransportOffer['mode'][] = ['train', 'bus', 'flight'];
/** Change-over rules for combined routes: at least 2 h to connect, at most 12 h waiting. */
export const MIN_CONNECTION_MIN = 120;
export const MAX_WAIT_MIN = 720;
const MAX_COMBINED = 3;
/** A combined route may take at most this much longer than the slowest direct option. */
export const MAX_DURATION_FACTOR = 1.25;

/** Local `YYYY-MM-DDTHH:MM` without seconds, as the domain engines expect. */
function like(o: TransportOffer): TransportOffer & TransportLike {
  return { ...o, groupFare: o.price.amount, departAt: o.departAt.slice(0, 16), arriveAt: o.arriveAt.slice(0, 16) };
}

function strip(o: TransportOffer & TransportLike): TransportOffer {
  const { groupFare: _g, ...rest } = o;
  void _g;
  return rest;
}

async function offers(
  set: ProviderSet,
  from: string,
  to: string,
  date: ISODate,
  travellers: Travellers,
  ms: number,
): Promise<TransportOffer[]> {
  const providers: TransportProvider[] = [...set.train, ...set.bus, ...set.flight];
  const lists = await Promise.all(
    providers.map((p) => withTimeout(p.search({ from, to, date, travellers }), ms, `${p.name} ${from}→${to}`)),
  );
  return lists.flat();
}

/** Class-level offers → one entry per departure, cheapest class first; sorted by departure time. */
export function groupServices(list: TransportOffer[]): TransportService[] {
  const byKey = new Map<string, TransportService>();
  for (const o of list) {
    const key = [o.source, o.mode, o.number ?? o.operator, o.departAt].join('|');
    const s = byKey.get(key);
    if (s) s.offers.push(o);
    else {
      byKey.set(key, {
        key,
        mode: o.mode,
        operator: o.operator,
        ...(o.number ? { number: o.number } : {}),
        fromPoint: o.fromPoint,
        toPoint: o.toPoint,
        departAt: o.departAt,
        arriveAt: o.arriveAt,
        durationMin: o.durationMin,
        offers: [o],
      });
    }
  }
  const services = [...byKey.values()];
  for (const s of services) s.offers.sort((a, b) => a.price.amount - b.price.amount);
  return services.sort((a, b) => (a.departAt < b.departAt ? -1 : a.departAt > b.departAt ? 1 : 0));
}

async function direction(
  set: ProviderSet,
  from: string,
  to: string,
  date: ISODate,
  travellers: Travellers,
  clock: Clock,
  ms: number,
  arriveBy: ISODate | undefined,
): Promise<DirectionTransport> {
  const place = (code: string) => ({ code, name: set.places.get(code)?.name ?? code });
  const hubs = set.places.places().filter((p) => p.code !== from && p.code !== to);
  const direct = await offers(set, from, to, date, travellers, ms);
  const directLike = direct.map(like);
  const slowest = Math.max(0, ...direct.map((o) => o.durationMin));

  const viaHubs = await Promise.all(
    hubs.map(async (h) => {
      const [first, sameDay, nextDay] = await Promise.all([
        offers(set, from, h.code, date, travellers, ms),
        offers(set, h.code, to, date, travellers, ms),
        offers(set, h.code, to, addDays(date, 1), travellers, ms),
      ]);
      const combos = combineLegs(first.map(like), [...sameDay, ...nextDay].map(like), {
        minConnectionMin: MIN_CONNECTION_MIN,
        maxWaitMin: MAX_WAIT_MIN,
        ...(arriveBy ? { arriveBy: `${arriveBy}T23:59` } : {}),
        ...(slowest ? { maxDurationMin: Math.round(slowest * MAX_DURATION_FACTOR) } : {}),
      });
      // Cheapest combination through this hub that no direct option beats on both price and time.
      const best = worthShowing(combos, directLike)[0];
      return best ? { hub: h, best, groupFare: best.groupFare } : null;
    }),
  );

  const kept = viaHubs
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.groupFare - b.groupFare)
    .slice(0, MAX_COMBINED);

  const combined: CombinedRoute[] = kept.map(({ hub, best }) => ({
    key: `${hub.code}|${best.first.departAt}|${best.second.departAt}`,
    via: { code: hub.code, name: hub.name },
    first: strip(best.first),
    second: strip(best.second),
    groupFare: best.groupFare,
    durationMin: best.durationMin,
    waitMin: best.waitMin,
  }));

  const s = summarizeTransport(directLike);
  const summary: DirectionTransport['summary'] = {};
  if (s.cheapest) summary.cheapest = strip(s.cheapest);
  if (s.fastest) summary.fastest = strip(s.fastest);
  if (s.overnight) summary.overnight = strip(s.overnight);

  return {
    from: place(from),
    to: place(to),
    date,
    services: groupServices(direct),
    summary,
    combined,
    noDirect: MODES.filter((m) => !direct.some((o) => o.mode === m)),
    fetchedAt: clock().toISOString(),
  };
}

/**
 * "Getting there and back" for chosen dates (brief §2.2 tab 3): every direct train, bus and flight
 * both ways with per-class fares and booking links, the cheapest / fastest / overnight picks, and
 * combined routes via a hub when they beat every direct option on price or time.
 */
export async function buildTransportSection(
  set: ProviderSet,
  args: { from: string; to: string; onwardDate: ISODate; returnDate: ISODate; travellers: Travellers; tripEnd?: ISODate },
  opts: { clock: Clock; timeoutMs: number },
): Promise<TransportSection> {
  const [onward, back] = await Promise.all([
    direction(set, args.from, args.to, args.onwardDate, args.travellers, opts.clock, opts.timeoutMs, undefined),
    // Combined routes home must get you back by the last day of the trip.
    direction(set, args.to, args.from, args.returnDate, args.travellers, opts.clock, opts.timeoutMs, args.tripEnd),
  ]);
  const providers: TransportProvider[] = [...set.train, ...set.bus, ...set.flight];
  return { onward, return: back, sampleData: providers.every((p) => p.id.startsWith('mock')) };
}
