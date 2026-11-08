import type { CalendarEvent, MonthClimate } from '@tripsaver/domain';

/** Shared Indian holidays (2026–27). Dates marked approx. are mock estimates. */
const NATIONAL: CalendarEvent[] = [
  { name: 'Diwali', start: '2026-11-07', end: '2026-11-09', kind: 'festival', priceImpact: 1.3 },
  { name: 'Republic Day long weekend', start: '2027-01-23', end: '2027-01-26', kind: 'longWeekend', priceImpact: 1.25 },
  { name: 'Holi (approx.)', start: '2027-03-21', end: '2027-03-22', kind: 'festival', priceImpact: 1.2 },
];

export const MOCK_EVENTS: Record<string, CalendarEvent[]> = {
  GOA: [
    ...NATIONAL,
    { name: 'Feast of St Francis Xavier', start: '2026-12-03', end: '2026-12-03', kind: 'local', priceImpact: 1.15 },
    { name: 'Goa Liberation Day', start: '2026-12-19', end: '2026-12-19', kind: 'holiday', priceImpact: 1.2 },
    { name: 'Christmas–New Year peak', start: '2026-12-20', end: '2026-12-31', kind: 'season', priceImpact: 1.8 },
    { name: 'New Year week', start: '2027-01-01', end: '2027-01-03', kind: 'season', priceImpact: 1.5 },
    { name: 'Goa Carnival (approx.)', start: '2027-02-06', end: '2027-02-09', kind: 'local', priceImpact: 1.3 },
  ],
  MANALI: [
    ...NATIONAL,
    { name: 'Christmas–New Year snow season', start: '2026-12-22', end: '2027-01-02', kind: 'season', priceImpact: 1.6 },
    { name: 'Manali Winter Carnival (approx.)', start: '2027-01-02', end: '2027-01-06', kind: 'local', priceImpact: 1.3 },
  ],
  JAIPUR: [
    ...NATIONAL,
    { name: 'Christmas–New Year holidays', start: '2026-12-23', end: '2027-01-01', kind: 'season', priceImpact: 1.4 },
    { name: 'Jaipur Literature Festival (approx.)', start: '2027-01-28', end: '2027-02-01', kind: 'local', priceImpact: 1.35 },
  ],
  KERALA: [
    ...NATIONAL,
    { name: 'Christmas–New Year peak', start: '2026-12-20', end: '2027-01-01', kind: 'season', priceImpact: 1.6 },
    { name: 'Cochin Carnival (approx.)', start: '2026-12-25', end: '2027-01-01', kind: 'local', priceImpact: 1.1 },
  ],
  DARJEELING: [
    ...NATIONAL,
    { name: 'Christmas–New Year holidays', start: '2026-12-22', end: '2027-01-01', kind: 'season', priceImpact: 1.4 },
    { name: 'School winter holidays (West Bengal)', start: '2026-12-24', end: '2027-01-05', kind: 'school', priceImpact: 1.2 },
  ],
};

type Row = [priceIndex: number, maxC: number, minC: number, summary: string];

function months(rows: Row[]): MonthClimate[] {
  return rows.map(([priceIndex, maxC, minC, summary], i) => ({ month: i + 1, priceIndex, maxC, minC, summary }));
}

export const MOCK_CLIMATE: Record<string, MonthClimate[]> = {
  GOA: months([
    [1.05, 31, 21, 'Sunny and dry'], [0.95, 31, 22, 'Sunny and dry'], [0.85, 32, 24, 'Warm'],
    [0.8, 33, 26, 'Hot and humid'], [0.75, 33, 27, 'Hot, pre-monsoon'], [0.6, 30, 25, 'Monsoon'],
    [0.55, 29, 24, 'Heavy monsoon'], [0.55, 29, 24, 'Monsoon'], [0.65, 30, 24, 'Late monsoon'],
    [0.9, 32, 24, 'Post-monsoon, green'], [1.1, 33, 23, 'Pleasant'], [1.4, 32, 21, 'Dry and sunny, best season'],
  ]),
  MANALI: months([
    [0.75, 9, -3, 'Snow, very cold'], [0.7, 11, -2, 'Snow likely'], [0.85, 15, 2, 'Cold, clearing'],
    [1.05, 20, 6, 'Pleasant'], [1.35, 24, 9, 'Peak summer season'], [1.4, 27, 12, 'Peak summer season'],
    [0.75, 26, 15, 'Monsoon, landslide risk'], [0.7, 25, 14, 'Monsoon'], [0.85, 23, 10, 'Clear after rains'],
    [1.0, 20, 6, 'Crisp autumn'], [0.8, 15, 2, 'Cold'], [1.1, 11, -1, 'Cold, first snow'],
  ]),
  JAIPUR: months([
    [1.2, 22, 8, 'Cool, sunny'], [1.1, 25, 11, 'Pleasant'], [0.95, 31, 16, 'Warm'],
    [0.75, 37, 22, 'Hot'], [0.65, 41, 27, 'Very hot'], [0.65, 39, 28, 'Very hot'],
    [0.7, 34, 26, 'Monsoon'], [0.75, 32, 25, 'Monsoon'], [0.85, 33, 23, 'Warm'],
    [1.0, 33, 19, 'Pleasant'], [1.15, 29, 13, 'Pleasant, festive'], [1.3, 24, 9, 'Cool, sunny'],
  ]),
  KERALA: months([
    [1.15, 31, 23, 'Dry and warm'], [1.0, 32, 24, 'Dry and warm'], [0.9, 33, 25, 'Hot'],
    [0.85, 33, 26, 'Hot, humid'], [0.75, 32, 26, 'Pre-monsoon showers'], [0.6, 29, 24, 'Monsoon'],
    [0.6, 29, 24, 'Monsoon'], [0.65, 29, 24, 'Monsoon, Onam season'], [0.8, 30, 24, 'Green, fewer crowds'],
    [0.9, 30, 24, 'Post-monsoon'], [1.05, 31, 24, 'Pleasant'], [1.35, 31, 23, 'Peak season'],
  ]),
  DARJEELING: months([
    [0.7, 10, 2, 'Cold, clear views'], [0.75, 11, 3, 'Cold'], [1.0, 15, 7, 'Clear, spring'],
    [1.25, 18, 10, 'Peak spring season'], [1.35, 19, 12, 'Peak season'], [0.9, 20, 14, 'Early monsoon'],
    [0.6, 20, 15, 'Monsoon, landslide risk'], [0.6, 20, 15, 'Monsoon'], [0.75, 20, 14, 'Late monsoon'],
    [1.2, 19, 11, 'Puja holidays, clear'], [1.0, 15, 7, 'Clear, Kanchenjunga views'], [0.95, 12, 4, 'Cold'],
  ]),
};
