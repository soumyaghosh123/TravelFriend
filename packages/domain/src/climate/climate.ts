import type { ISODate } from '../types.js';

/** One day of observed weather (a weather archive row). Missing readings are null. */
export interface DailyWeather {
  date: ISODate;
  maxC: number | null;
  minC: number | null;
  rainMm: number | null;
}

/** Typical weather for a month, averaged over the years observed. */
export interface MonthNormals {
  /** 1–12. */
  month: number;
  maxC: number;
  minC: number;
  /** Mean total rain for the month. */
  rainMm: number;
  /** Mean number of days with ≥ 1 mm of rain. */
  rainyDays: number;
}

const RAINY_DAY_MM = 1;
const round1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/** Monthly normals from daily observations: mean daily max/min; rain and rainy days per month, averaged over years. */
export function climateNormals(days: DailyWeather[]): MonthNormals[] {
  const byMonth = new Map<
    number,
    { max: number[]; min: number[]; perYear: Map<string, { rain: number; rainy: number }> }
  >();
  for (const d of days) {
    const month = Number(d.date.slice(5, 7));
    const year = d.date.slice(0, 4);
    const m = byMonth.get(month) ?? {
      max: [] as number[],
      min: [] as number[],
      perYear: new Map<string, { rain: number; rainy: number }>(),
    };
    if (d.maxC !== null) m.max.push(d.maxC);
    if (d.minC !== null) m.min.push(d.minC);
    if (d.rainMm !== null) {
      const y = m.perYear.get(year) ?? { rain: 0, rainy: 0 };
      y.rain += d.rainMm;
      if (d.rainMm >= RAINY_DAY_MM) y.rainy += 1;
      m.perYear.set(year, y);
    }
    byMonth.set(month, m);
  }
  return [...byMonth.entries()]
    .filter(([, m]) => m.max.length > 0 && m.min.length > 0)
    .sort(([a], [b]) => a - b)
    .map(([month, m]) => {
      const years = [...m.perYear.values()];
      return {
        month,
        maxC: round1(mean(m.max)),
        minC: round1(mean(m.min)),
        rainMm: years.length ? round1(mean(years.map((y) => y.rain))) : 0,
        rainyDays: years.length ? round1(mean(years.map((y) => y.rainy))) : 0,
      };
    });
}

/** "Warm, mostly dry", "Cold, freezing nights, some rainy days" … */
export function climateSummary(n: Pick<MonthNormals, 'maxC' | 'minC' | 'rainMm' | 'rainyDays'>): string {
  const parts: string[] = [];
  parts.push(n.maxC >= 33 ? 'Hot' : n.maxC >= 26 ? 'Warm' : n.maxC >= 16 ? 'Mild' : 'Cold');
  if (n.minC <= 2) parts.push('freezing nights');
  else if (n.minC <= 10) parts.push('cold nights');
  parts.push(
    n.rainyDays >= 15 || n.rainMm >= 300
      ? 'monsoon: rain on most days'
      : n.rainyDays >= 7
        ? 'frequent showers'
        : n.rainyDays >= 2
          ? 'some rainy days'
          : 'mostly dry',
  );
  return parts.join(', ');
}
