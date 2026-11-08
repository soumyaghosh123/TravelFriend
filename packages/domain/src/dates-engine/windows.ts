import { addDays, daysInMonth, diffDays, isoDate } from '../dates.js';
import type { ISODate } from '../types.js';

/** The cheapest suitable way to travel on one departure date, priced for the whole group. */
export interface LegOption {
  departDate: ISODate;
  arriveDate: ISODate;
  /** Local "HH:MM". Needed to allow a same-day connection; without times it is rejected. */
  departTime?: string;
  arriveTime?: string;
  groupFare: number;
  source: string;
}

export interface CheapestDatesInput {
  year: number;
  month: number;
  days: number;
  onwardByDate: Record<ISODate, LegOption | undefined>;
  /** One or more ways home departing on that date (e.g. a cheap overnight train and a same-day flight). */
  returnByDate: Record<ISODate, LegOption | LegOption[] | undefined>;
  /** Hotel cost for the group for the night starting on that date. */
  nightlyGroupPrice: Record<ISODate, number | undefined>;
  /** Local transport + food + sights for the group, per day at the destination. */
  localPerDay: number;
}

export type Band = 1 | 2 | 3 | 4 | 5;

export interface DateWindow {
  start: ISODate;
  end: ISODate;
  feasible: boolean;
  total: number;
  hotelNights: number;
  daysAtDestination: number;
  breakdown: { onward: number; return: number; hotel: number; local: number };
  band: Band | null;
}

function infeasible(start: ISODate, end: ISODate): DateWindow {
  return {
    start,
    end,
    feasible: false,
    total: 0,
    hotelNights: 0,
    daysAtDestination: 0,
    breakdown: { onward: 0, return: 0, hotel: 0, local: 0 },
    band: null,
  };
}

/** The return must leave after the onward journey arrives. Same-day needs known times. */
function departsAfter(onward: LegOption, ret: LegOption): boolean {
  if (ret.departDate > onward.arriveDate) return true;
  if (ret.departDate < onward.arriveDate) return false;
  return onward.arriveTime !== undefined && ret.departTime !== undefined && ret.departTime > onward.arriveTime;
}

function evaluate(input: CheapestDatesInput, start: ISODate, end: ISODate): DateWindow {
  const onward = input.onwardByDate[start];
  if (!onward) return infeasible(start, end);
  const arrive = onward.arriveDate;

  // Latest return departure that still gets home by the last day; cheapest option on that date.
  let ret: LegOption | undefined;
  for (let d = end; d >= arrive && !ret; d = addDays(d, -1)) {
    const options = ([] as (LegOption | undefined)[]).concat(input.returnByDate[d]);
    for (const option of options) {
      if (!option || option.arriveDate > end || !departsAfter(onward, option)) continue;
      if (!ret || option.groupFare < ret.groupFare) ret = option;
    }
  }
  if (!ret) return infeasible(start, end);

  let hotel = 0;
  for (let n = arrive; n < ret.departDate; n = addDays(n, 1)) {
    const price = input.nightlyGroupPrice[n];
    if (price === undefined) return infeasible(start, end);
    hotel += price;
  }

  const hotelNights = diffDays(arrive, ret.departDate);
  const daysAtDestination = hotelNights + 1;
  const local = input.localPerDay * daysAtDestination;
  return {
    start,
    end,
    feasible: true,
    total: onward.groupFare + ret.groupFare + hotel + local,
    hotelNights,
    daysAtDestination,
    breakdown: { onward: onward.groupFare, return: ret.groupFare, hotel, local },
    band: null,
  };
}

/** Rank-based quintiles over feasible windows; equal totals share a band. */
function assignBands(windows: DateWindow[]): void {
  const totals = windows.filter((w) => w.feasible).map((w) => w.total).sort((a, b) => a - b);
  const n = totals.length;
  for (const w of windows) {
    if (!w.feasible) continue;
    const rank = totals.indexOf(w.total);
    w.band = Math.min(5, 1 + Math.floor((rank * 5) / n)) as Band;
  }
}

/** Every start date in the month whose whole trip fits in the month (PLAN §6.2, A1, A2). */
export function computeWindows(input: CheapestDatesInput): DateWindow[] {
  const { year, month, days } = input;
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new RangeError(`Invalid month ${month}`);
  const monthDays = daysInMonth(year, month);
  if (!Number.isInteger(days) || days < 2 || days > monthDays) {
    throw new RangeError(`A ${days}-day trip must be between 2 and ${monthDays} days to fit in this month`);
  }

  const windows: DateWindow[] = [];
  for (let day = 1; day <= monthDays - days + 1; day++) {
    const start = isoDate(year, month, day);
    windows.push(evaluate(input, start, addDays(start, days - 1)));
  }
  assignBands(windows);
  return windows;
}
