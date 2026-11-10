import type { Place } from '../../interfaces.js';
import { draw } from '../rng.js';
import { MOCK_DESTINATIONS, MOCK_ORIGINS } from './places.js';

export interface RouteTemplate {
  id: string;
  mode: 'train' | 'bus' | 'flight';
  operator: string;
  number?: string;
  from: string;
  to: string;
  fromPoint: string;
  toPoint: string;
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
  departAt: string;
  durationMin: number;
  classes: { code: string; baseAdultFare: number }[];
}

const DAILY = [0, 1, 2, 3, 4, 5, 6];

function km(a: Place, b: Place): number {
  const r = (x: number) => (x * Math.PI) / 180;
  const h =
    Math.sin(r(b.lat - a.lat) / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function time(key: string, fromHour: number, toHour: number): string {
  const mins = Math.floor((fromHour + draw(key) * (toHour - fromHour)) * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** Hand-written featured route used by the brief's example (sample fares). */
const KOL_GOA: RouteTemplate[] = [
  {
    id: 'KOL-GOA-T18047',
    mode: 'train',
    operator: 'Indian Railways',
    number: '18047 Amaravati Express',
    from: 'KOL',
    to: 'GOA',
    fromPoint: 'HWH',
    toPoint: 'MAO',
    daysOfWeek: [0, 2, 4, 5],
    departAt: '11:55',
    durationMin: 2055,
    classes: [
      { code: 'SL', baseAdultFare: 1005 },
      { code: '3A', baseAdultFare: 2650 },
      { code: '2A', baseAdultFare: 3890 },
    ],
  },
  {
    id: 'KOL-GOA-T22897',
    mode: 'train',
    operator: 'Indian Railways',
    number: '22897 Superfast',
    from: 'KOL',
    to: 'GOA',
    fromPoint: 'HWH',
    toPoint: 'VSG',
    daysOfWeek: [3],
    departAt: '21:30',
    durationMin: 2060,
    classes: [
      { code: '3A', baseAdultFare: 2780 },
      { code: '2A', baseAdultFare: 4050 },
    ],
  },
  {
    id: 'KOL-GOA-F1',
    mode: 'flight',
    operator: 'IndiGo',
    number: '6E sample',
    from: 'KOL',
    to: 'GOA',
    fromPoint: 'CCU',
    toPoint: 'GOX',
    daysOfWeek: DAILY,
    departAt: '06:10',
    durationMin: 165,
    classes: [{ code: 'Economy', baseAdultFare: 5200 }],
  },
  {
    id: 'KOL-GOA-F2',
    mode: 'flight',
    operator: 'Air India Express',
    number: 'IX sample · 1 stop',
    from: 'KOL',
    to: 'GOA',
    fromPoint: 'CCU',
    toPoint: 'GOI',
    daysOfWeek: DAILY,
    departAt: '13:40',
    durationMin: 300,
    classes: [{ code: 'Economy', baseAdultFare: 4600 }],
  },
];

/** Plausible routes for every other origin × destination pair, derived from distance. */
function generated(o: Place, d: Place): RouteTemplate[] {
  const dist = km(o, d);
  const key = `${o.code}-${d.code}`;
  const out: RouteTemplate[] = [];

  if (d.stations.length > 0 && o.stations.length > 0 && dist < 2600) {
    const trainHours = (dist * 1.35) / 55;
    out.push({
      id: `${key}-T1`,
      mode: 'train',
      operator: 'Indian Railways',
      number: `${12000 + (Math.floor(draw(key) * 900) + 100)} Express`,
      from: o.code,
      to: d.code,
      fromPoint: o.stations[0]!,
      toPoint: d.stations[0]!,
      daysOfWeek: DAILY,
      departAt: time(`${key}-T1`, 6, 23),
      durationMin: Math.round(trainHours * 60),
      classes: [
        { code: 'SL', baseAdultFare: Math.round(dist * 0.45) },
        { code: '3A', baseAdultFare: Math.round(dist * 1.2) },
        { code: '2A', baseAdultFare: Math.round(dist * 1.75) },
        { code: '1A', baseAdultFare: Math.round(dist * 2.9) },
      ],
    });
    out.push({
      id: `${key}-T2`,
      mode: 'train',
      operator: 'Indian Railways',
      number: `${22000 + (Math.floor(draw(`${key}2`) * 900) + 100)} Superfast`,
      from: o.code,
      to: d.code,
      fromPoint: o.stations.at(-1)!,
      toPoint: d.stations.at(-1)!,
      daysOfWeek: [1, 4, 6],
      departAt: time(`${key}-T2`, 6, 23),
      durationMin: Math.round(trainHours * 0.85 * 60),
      classes: [
        { code: '3A', baseAdultFare: Math.round(dist * 1.35) },
        { code: '2A', baseAdultFare: Math.round(dist * 1.95) },
      ],
    });
  }

  if (dist <= 1100) {
    const busMin = Math.round(((dist * 1.3) / 45) * 60);
    out.push({
      id: `${key}-B1`,
      mode: 'bus',
      operator: 'Volvo AC Sleeper (sample)',
      from: o.code,
      to: d.code,
      fromPoint: o.busPoints[0]!,
      toPoint: d.busPoints[0]!,
      daysOfWeek: DAILY,
      departAt: time(`${key}-B1`, 17, 22),
      durationMin: busMin,
      classes: [{ code: 'AC Sleeper', baseAdultFare: Math.round(dist * 1.6) }],
    });
    out.push({
      id: `${key}-B2`,
      mode: 'bus',
      operator: 'State transport (sample)',
      from: o.code,
      to: d.code,
      fromPoint: o.busPoints[0]!,
      toPoint: d.busPoints[0]!,
      daysOfWeek: DAILY,
      departAt: time(`${key}-B2`, 5, 12),
      durationMin: Math.round(busMin * 1.1),
      classes: [{ code: 'Non-AC Seater', baseAdultFare: Math.round(dist * 0.9) }],
    });
  }

  const flightMin = Math.round(60 + dist / 12);
  out.push({
    id: `${key}-F1`,
    mode: 'flight',
    operator: 'IndiGo',
    number: '6E sample',
    from: o.code,
    to: d.code,
    fromPoint: o.airports[0]!,
    toPoint: d.airports[0]!,
    daysOfWeek: DAILY,
    departAt: time(`${key}-F1`, 6, 21),
    durationMin: flightMin,
    classes: [{ code: 'Economy', baseAdultFare: Math.round(2500 + dist * 1.8) }],
  });
  out.push({
    id: `${key}-F2`,
    mode: 'flight',
    operator: 'Air India Express',
    number: 'IX sample · 1 stop',
    from: o.code,
    to: d.code,
    fromPoint: o.airports[0]!,
    toPoint: d.airports.at(-1)!,
    daysOfWeek: DAILY,
    departAt: time(`${key}-F2`, 6, 21),
    durationMin: flightMin + 90,
    classes: [{ code: 'Economy', baseAdultFare: Math.round((2500 + dist * 1.8) * 0.88) }],
  });
  return out;
}

function reverse(t: RouteTemplate): RouteTemplate {
  return { ...t, id: `${t.id}-R`, from: t.to, to: t.from, fromPoint: t.toPoint, toPoint: t.fromPoint };
}

/**
 * Every place, starting cities first. "From" accepts any place, so each pair gets routes once (Jaipur →
 * Goa as well as Kolkata → Goa); routes between starting cities let combined journeys change at a hub
 * (Kolkata → Hyderabad → Goa). A starting city keeps its own entry when it goes first; the other end
 * uses its destination entry when it has one.
 */
const ORDER: { code: string; first: Place; second: Place }[] = [
  ...MOCK_ORIGINS.map((o) => ({
    code: o.code,
    first: o,
    second: MOCK_DESTINATIONS.find((d) => d.code === o.code) ?? o,
  })),
  ...MOCK_DESTINATIONS.filter((d) => !MOCK_ORIGINS.some((o) => o.code === d.code)).map((d) => ({
    code: d.code,
    first: d,
    second: d,
  })),
];

const PAIRS: RouteTemplate[] = ORDER.flatMap((a, i) =>
  ORDER.slice(i + 1).flatMap((b) =>
    a.code === 'KOL' && b.code === 'GOA' ? KOL_GOA : generated(a.first, b.second),
  ),
);

/** All templates, both directions. */
export const ROUTES: RouteTemplate[] = PAIRS.flatMap((t) => [t, reverse(t)]);
