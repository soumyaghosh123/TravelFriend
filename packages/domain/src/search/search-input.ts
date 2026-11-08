import { z } from 'zod';
import { addDays, daysInMonth, isoDate } from '../dates.js';
import { suggestRooms } from '../pricing/rooms.js';
import type { ISODate } from '../types.js';

/**
 * The home-page search (brief §2): six required inputs plus optional "More preferences".
 * Shared by the web form (client-side checks) and the API (authoritative checks).
 * Issue messages are i18n keys (e.g. `days.range`); the UI translates them.
 */

export const HOTEL_TYPES = ['budget', '3-star', '4-star', '5-star', 'homestay', 'resort', 'hostel'] as const;
export type HotelType = (typeof HOTEL_TYPES)[number];
export const DEFAULT_HOTEL_TYPES: HotelType[] = ['3-star', '4-star', '5-star'];

export const TRAVEL_MODES = ['any', 'train', 'bus', 'flight'] as const;
export const AC_PREFS = ['any', 'ac', 'nonac'] as const;
export const BERTH_PREFS = ['any', 'sleeper', 'seater'] as const;
export const FOOD_PREFS = ['any', 'veg', 'nonveg', 'jain'] as const;
export const COMPANIONS = ['kids', 'seniors'] as const;
export const INTERESTS = ['beaches', 'temples', 'adventure', 'nightlife', 'shopping', 'nature'] as const;

export const MIN_DAYS = 2;
export const MAX_DAYS = 31;
export const MAX_ADULTS = 20;
export const MAX_CHILDREN = 10;
export const MAX_TRAVELLERS = 20;
export const MAX_CHILD_AGE = 17;
/** How many months ahead (including the current one) a search may target. */
export const MONTHS_AHEAD = 12;

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function parseMonth(month: string): { year: number; month: number } {
  const [y, m] = month.split('-').map(Number);
  return { year: y!, month: m! };
}

/** Last start date that keeps an N-day trip inside the month (assumption A2). */
export function latestStartDate(month: string, days: number): ISODate {
  const { year, month: m } = parseMonth(month);
  return addDays(isoDate(year, m, daysInMonth(year, m)), -(days - 1));
}

/** `YYYY-MM` for a month offset from `today`'s month. */
export function monthFrom(today: ISODate, offset: number): string {
  const [y, m] = today.split('-').map(Number);
  const idx = y! * 12 + (m! - 1) + offset;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

const travellersSchema = z
  .object({
    adults: z.number({ error: 'adults.range' }).int('adults.range').min(1, 'adults.range').max(MAX_ADULTS, 'adults.range'),
    childAges: z
      .array(
        z.number({ error: 'childAge.range' }).int('childAge.range').min(0, 'childAge.range').max(MAX_CHILD_AGE, 'childAge.range'),
      )
      .max(MAX_CHILDREN, 'children.max'),
    rooms: z.number({ error: 'rooms.range' }).int('rooms.range').min(1, 'rooms.range').optional(),
  })
  .superRefine((t, ctx) => {
    if (t.adults + t.childAges.length > MAX_TRAVELLERS) {
      ctx.addIssue({ code: 'custom', path: ['adults'], message: 'travellers.max' });
    }
    if (t.rooms !== undefined && t.rooms > t.adults) {
      ctx.addIssue({ code: 'custom', path: ['rooms'], message: 'rooms.range' });
    }
  })
  .transform((t) => ({ ...t, rooms: t.rooms ?? Math.min(t.adults, suggestRooms(t)) }));

const preferencesSchema = z.object({
  stayNear: z.string().trim().max(80, 'stayNear.max').optional(),
  budget: z.number({ error: 'budget.range' }).int('budget.range').min(1, 'budget.range').max(10_000_000, 'budget.range').optional(),
  travelMode: z.enum(TRAVEL_MODES).optional(),
  ac: z.enum(AC_PREFS).optional(),
  berth: z.enum(BERTH_PREFS).optional(),
  food: z.enum(FOOD_PREFS).optional(),
  companions: z.array(z.enum(COMPANIONS)).optional(),
  interests: z.array(z.enum(INTERESTS)).optional(),
});

/** Builds the schema relative to `today` (passed in, so the domain stays deterministic). */
export function makeSearchInputSchema(today: ISODate) {
  const thisMonth = today.slice(0, 7);
  const lastMonth = monthFrom(today, MONTHS_AHEAD - 1);

  return z
    .object({
      from: z.string({ error: 'from.required' }).trim().min(1, 'from.required'),
      to: z.string({ error: 'to.required' }).trim().min(1, 'to.required'),
      days: z.number({ error: 'days.range' }).int('days.range').min(MIN_DAYS, 'days.range').max(MAX_DAYS, 'days.range'),
      month: z
        .string({ error: 'month.format' })
        .regex(MONTH_RE, 'month.format')
        .refine((m) => m >= thisMonth, 'month.past')
        .refine((m) => m <= lastMonth, 'month.tooFar'),
      hotelTypes: z.array(z.enum(HOTEL_TYPES)).min(1, 'hotelTypes.min'),
      travellers: travellersSchema,
      preferences: preferencesSchema.optional(),
    })
    .superRefine((s, ctx) => {
      if (s.from === s.to) ctx.addIssue({ code: 'custom', path: ['to'], message: 'to.sameAsFrom' });
      const { year, month } = parseMonth(s.month);
      if (s.days > daysInMonth(year, month)) {
        ctx.addIssue({ code: 'custom', path: ['days'], message: 'days.longerThanMonth' });
      } else if (s.month === thisMonth && latestStartDate(s.month, s.days) < today) {
        ctx.addIssue({ code: 'custom', path: ['month'], message: 'month.noWindowLeft' });
      }
    });
}

export type SearchInputSchema = ReturnType<typeof makeSearchInputSchema>;
/** What a client sends (rooms may be left out). */
export type SearchInput = z.input<SearchInputSchema>;
/** After validation: trimmed, rooms filled in. */
export type ValidSearchInput = z.output<SearchInputSchema>;

/** A validation problem in a transport-neutral shape (API responses, form errors). */
export interface SearchInputIssue {
  path: string;
  message: string;
}

export function toIssues(error: z.ZodError): SearchInputIssue[] {
  return error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}
