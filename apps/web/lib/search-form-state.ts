import {
  DEFAULT_HOTEL_TYPES,
  HOTEL_TYPES,
  makeSearchInputSchema,
  MAX_DAYS,
  MIN_DAYS,
  monthFrom,
  toIssues,
  type HotelType,
  type SearchInput,
  type SearchInputIssue,
} from '@tripsaver/domain';
import { initialTravellers, type TravellersState } from './travellers';

export type Preferences = NonNullable<SearchInput['preferences']>;

export interface PlaceOption {
  code: string;
  name: string;
  kind: 'city' | 'region';
  stations: string[];
  airports: string[];
  busPoints: string[];
  /** Can be chosen as "To" (we have trips for it). */
  destination?: boolean;
}

export interface SearchFormState {
  from: PlaceOption | null;
  to: PlaceOption | null;
  days: number;
  month: string;
  hotelTypes: HotelType[];
  travellers: TravellersState;
  preferences: Preferences;
}

export const DEFAULT_DAYS = 5;

/** Values the form starts with; next month is the default because the current one may be half gone. */
export function defaultFormState(today: string): SearchFormState {
  return {
    from: null,
    to: null,
    days: DEFAULT_DAYS,
    month: monthFrom(today, 1),
    hotelTypes: [...DEFAULT_HOTEL_TYPES],
    travellers: initialTravellers(),
    preferences: {},
  };
}

/** Drops empty optional preferences so the request stays small and the API sees only what was chosen. */
function cleanPreferences(p: Preferences): Preferences | undefined {
  const out: Preferences = {};
  if (p.stayNear?.trim()) out.stayNear = p.stayNear.trim();
  if (p.budget !== undefined && !Number.isNaN(p.budget)) out.budget = p.budget;
  if (p.travelMode && p.travelMode !== 'any') out.travelMode = p.travelMode;
  if (p.ac && p.ac !== 'any') out.ac = p.ac;
  if (p.berth && p.berth !== 'any') out.berth = p.berth;
  if (p.food && p.food !== 'any') out.food = p.food;
  if (p.companions?.length) out.companions = p.companions;
  if (p.interests?.length) out.interests = p.interests;
  return Object.keys(out).length ? out : undefined;
}

export type BuildResult = { ok: true; input: SearchInput } | { ok: false; issues: SearchInputIssue[] };

/** Turns form state into the API request, running the same validation the API runs. */
export function buildSearchInput(s: SearchFormState, today: string): BuildResult {
  const missingAges: SearchInputIssue[] = s.travellers.childAges.flatMap((a, i) =>
    a === null ? [{ path: `travellers.childAges.${i}`, message: 'childAge.required' }] : [],
  );
  const input: SearchInput = {
    from: s.from?.code ?? '',
    to: s.to?.code ?? '',
    days: s.days,
    month: s.month,
    hotelTypes: s.hotelTypes,
    travellers: {
      adults: s.travellers.adults,
      childAges: s.travellers.childAges.map((a) => a ?? 0),
      rooms: s.travellers.rooms,
    },
    preferences: cleanPreferences(s.preferences),
  };
  if (!input.preferences) delete input.preferences;
  const parsed = makeSearchInputSchema(today).safeParse(input);
  const issues = [...missingAges, ...(parsed.success ? [] : toIssues(parsed.error))];
  return issues.length ? { ok: false, issues } : { ok: true, input };
}

/** First issue for a field (exact path or anything beneath it), for showing one message per field. */
export function issueFor(issues: SearchInputIssue[], path: string): string | undefined {
  return issues.find((i) => i.path === path || i.path.startsWith(`${path}.`))?.message;
}

// ── URL prefill ("Change search" and destination cards link back to /?…) ──

export interface SearchPrefill {
  from?: string;
  to?: string;
  days?: number;
  month?: string;
  hotelTypes?: HotelType[];
  adults?: number;
  childAges?: number[];
  rooms?: number;
}

function intIn(v: string | undefined, min: number, max: number): number | undefined {
  if (v === undefined || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= min && n <= max ? n : undefined;
}

/** Reads a prefill from URL params, silently ignoring anything malformed. */
export function parsePrefill(q: Record<string, string | string[] | undefined>): SearchPrefill {
  const one = (k: string) => {
    const v = q[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const code = (v: string | undefined) => (v && /^[A-Z]{2,12}$/.test(v) ? v : undefined);
  const out: SearchPrefill = {};
  const from = code(one('from'));
  const to = code(one('to'));
  const days = intIn(one('days'), MIN_DAYS, MAX_DAYS);
  const month = one('month');
  const adults = intIn(one('adults'), 1, 20);
  const rooms = intIn(one('rooms'), 1, 20);
  if (from) out.from = from;
  if (to) out.to = to;
  if (days !== undefined) out.days = days;
  if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) out.month = month;
  const hotel = one('hotel')
    ?.split(',')
    .filter((h): h is HotelType => (HOTEL_TYPES as readonly string[]).includes(h));
  if (hotel?.length) out.hotelTypes = hotel;
  if (adults !== undefined) out.adults = adults;
  const kids = one('children');
  if (kids) {
    const ages = kids.split(',').map((a) => intIn(a, 0, 17));
    if (ages.every((a) => a !== undefined)) out.childAges = ages as number[];
  }
  if (rooms !== undefined) out.rooms = rooms;
  return out;
}

/** The query string that reproduces a search in the form. */
export function prefillQuery(input: {
  from: string;
  to: string;
  days: number;
  month: string;
  hotelTypes: readonly string[];
  travellers: { adults: number; childAges: number[]; rooms?: number };
}): string {
  const p = new URLSearchParams({
    from: input.from,
    to: input.to,
    days: String(input.days),
    month: input.month,
    hotel: input.hotelTypes.join(','),
    adults: String(input.travellers.adults),
  });
  if (input.travellers.childAges.length) p.set('children', input.travellers.childAges.join(','));
  if (input.travellers.rooms !== undefined) p.set('rooms', String(input.travellers.rooms));
  return p.toString();
}
