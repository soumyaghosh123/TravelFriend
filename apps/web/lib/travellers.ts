import {
  DEFAULT_PRICING_RULES,
  fareTypeForAge,
  MAX_ADULTS,
  MAX_CHILDREN,
  suggestRooms,
  type FareType,
} from '@tripsaver/domain';

/** Head-count picker state. A child's age is `null` until the user picks it. */
export interface TravellersState {
  adults: number;
  childAges: (number | null)[];
  rooms: number;
  /** Once the user changes rooms by hand we stop auto-suggesting. */
  roomsEdited: boolean;
}

export type TravellersAction =
  | { type: 'adults'; value: number }
  | { type: 'addChild' }
  | { type: 'removeChild' }
  | { type: 'childAge'; index: number; age: number }
  | { type: 'rooms'; value: number };

/** Rooms suggested for the current head count (children without an age yet count as young). */
export function suggestedRooms(adults: number, childAges: (number | null)[]): number {
  const ages = childAges.map((a) => a ?? 0);
  return Math.min(Math.max(adults, 1), suggestRooms({ adults, childAges: ages }));
}

function withRooms(s: TravellersState): TravellersState {
  const max = Math.max(s.adults, 1);
  const rooms = s.roomsEdited ? Math.min(Math.max(s.rooms, 1), max) : suggestedRooms(s.adults, s.childAges);
  return { ...s, rooms };
}

export function initialTravellers(
  adults = 2,
  childAges: (number | null)[] = [],
  rooms?: number,
): TravellersState {
  return withRooms({ adults, childAges, rooms: rooms ?? 1, roomsEdited: rooms !== undefined });
}

export function travellersReducer(s: TravellersState, a: TravellersAction): TravellersState {
  switch (a.type) {
    case 'adults':
      return withRooms({ ...s, adults: Math.min(Math.max(a.value, 1), MAX_ADULTS) });
    case 'addChild':
      return s.childAges.length >= MAX_CHILDREN ? s : withRooms({ ...s, childAges: [...s.childAges, null] });
    case 'removeChild':
      return withRooms({ ...s, childAges: s.childAges.slice(0, -1) });
    case 'childAge':
      return withRooms({ ...s, childAges: s.childAges.map((v, i) => (i === a.index ? a.age : v)) });
    case 'rooms':
      return withRooms({ ...s, rooms: a.value, roomsEdited: true });
  }
}

/** Default estimate band for a child's age (brief §2.4); providers' own child prices override it later. */
export function defaultFareType(age: number): FareType {
  return fareTypeForAge(age, 'train', '', DEFAULT_PRICING_RULES).fareType;
}
