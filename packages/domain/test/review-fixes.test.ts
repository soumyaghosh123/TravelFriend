import { describe, expect, test } from 'vitest';
import { computeWindows, type CheapestDatesInput, type LegOption } from '../src/dates-engine/windows.js';
import { priceForGroup } from '../src/pricing/group-price.js';
import { validateTravellers } from '../src/pricing/rules.js';

const nights = Object.fromEntries(
  Array.from({ length: 31 }, (_, i) => [`2026-12-${String(i + 1).padStart(2, '0')}`, 500]),
);

const base = (o: Partial<CheapestDatesInput>): CheapestDatesInput => ({
  year: 2026,
  month: 12,
  days: 2,
  onwardByDate: {},
  returnByDate: {},
  nightlyGroupPrice: nights,
  localPerDay: 0,
  ...o,
});

const leg = (
  departDate: string,
  departTime: string,
  arriveDate: string,
  arriveTime: string,
  groupFare: number,
): LegOption => ({ departDate, departTime, arriveDate, arriveTime, groupFare, source: 't' });

describe('review #1: a return cannot leave before you arrive', () => {
  test('same-day return departing before arrival is not feasible', () => {
    const ws = computeWindows(
      base({
        onwardByDate: { '2026-12-06': leg('2026-12-06', '11:55', '2026-12-07', '22:10', 2500) },
        returnByDate: { '2026-12-07': leg('2026-12-07', '13:40', '2026-12-07', '18:40', 9000) },
      }),
    );
    expect(ws.find((w) => w.start === '2026-12-06')!.feasible).toBe(false);
  });

  test('same-day return departing after arrival is allowed', () => {
    const w = computeWindows(
      base({
        onwardByDate: { '2026-12-06': leg('2026-12-06', '06:00', '2026-12-07', '09:00', 2500) },
        returnByDate: { '2026-12-07': leg('2026-12-07', '20:00', '2026-12-07', '23:00', 2500) },
      }),
    ).find((x) => x.start === '2026-12-06')!;
    expect(w.feasible).toBe(true);
    expect(w.hotelNights).toBe(0);
  });

  test('same-day pairing with unknown times is rejected', () => {
    const ws = computeWindows(
      base({
        onwardByDate: { '2026-12-06': { departDate: '2026-12-06', arriveDate: '2026-12-07', groupFare: 1, source: 't' } },
        returnByDate: { '2026-12-07': { departDate: '2026-12-07', arriveDate: '2026-12-07', groupFare: 1, source: 't' } },
      }),
    );
    expect(ws.find((w) => w.start === '2026-12-06')!.feasible).toBe(false);
  });
});

describe('review #2: several return options per date', () => {
  test('a flight home on the last day beats falling back to an earlier overnight train', () => {
    const w = computeWindows(
      base({
        days: 4,
        onwardByDate: { '2026-12-01': leg('2026-12-01', '06:00', '2026-12-01', '09:00', 1000) },
        returnByDate: {
          '2026-12-03': [leg('2026-12-03', '20:00', '2026-12-04', '20:00', 300)],
          '2026-12-04': [
            leg('2026-12-04', '20:00', '2026-12-05', '20:00', 300),
            leg('2026-12-04', '10:00', '2026-12-04', '13:00', 4000),
          ],
        },
      }),
    )[0]!;
    expect(w.feasible).toBe(true);
    expect(w.hotelNights).toBe(3);
    expect(w.breakdown.return).toBe(4000);
  });
});

describe('review #3: rooms override is validated', () => {
  test.each([[0], [-1], [1.5]])('rooms %d throws', (rooms) => {
    expect(() => validateTravellers({ adults: 2, childAges: [], rooms })).toThrow(RangeError);
  });
});

describe('review #5: provider child prices set the label and fare type', () => {
  test('a charged flight child is not labelled infant or free', () => {
    const g = priceForGroup({
      mode: 'flight',
      providerId: 'x',
      adultUnitPrice: 6000,
      travellers: { adults: 1, childAges: [3] },
      providerChildPrices: { 3: 4500 },
    });
    expect(g.lines[1]!.label).toBe('Child (3 y)');
    expect(g.lines[1]!.fareType).not.toBe('free');
  });

  test('a provider price of 0 is free', () => {
    const g = priceForGroup({
      mode: 'train',
      providerId: 'x',
      adultUnitPrice: 1000,
      travellers: { adults: 1, childAges: [5] },
      providerChildPrices: { 5: 0 },
    });
    expect(g.lines[1]!.fareType).toBe('free');
  });
});
