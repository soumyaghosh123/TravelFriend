import { diffDays } from '../dates.js';
import type { DateWindow } from './windows.js';

export interface RankedWindow extends DateWindow {
  rank: number;
  savingVsMostExpensive: number;
}

/**
 * The cheapest feasible windows, cheapest first (earlier start wins ties),
 * keeping start dates at least `minGapDays` apart so they are real alternatives.
 */
export function topWindows(windows: DateWindow[], count = 3, minGapDays = 3): RankedWindow[] {
  const feasible = windows.filter((w) => w.feasible);
  if (feasible.length === 0) return [];
  const maxTotal = Math.max(...feasible.map((w) => w.total));
  const ordered = [...feasible].sort((a, b) => a.total - b.total || (a.start < b.start ? -1 : 1));

  const picked: DateWindow[] = [];
  for (const w of ordered) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.abs(diffDays(p.start, w.start)) >= minGapDays)) picked.push(w);
  }
  return picked.map((w, i) => ({ ...w, rank: i + 1, savingVsMostExpensive: maxTotal - w.total }));
}
