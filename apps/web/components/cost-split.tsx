'use client';

import type { PlanCost } from '@tripsaver/domain';
import { useTranslations } from 'next-intl';

export const COST_PARTS = ['transport', 'hotels', 'local', 'food', 'sights', 'buffer'] as const;
export type CostPart = (typeof COST_PARTS)[number];

/** Mockup colours: transport, hotels, local, food, sights, buffer (PLAN §9.1). */
export const PART_COLOR: Record<CostPart, string> = {
  transport: '#0f766e',
  hotels: '#f59e0b',
  local: '#6366f1',
  food: '#ec4899',
  sights: '#0ea5e9',
  buffer: '#94a3b8',
};

/** The cost split as one bar with a legend (mockup `.plan .bar`). */
export function CostSplit({ cost }: { cost: PlanCost }) {
  const t = useTranslations('results.cost.rows');
  return (
    <div>
      <div
        className="my-2 flex h-2 overflow-hidden rounded-full bg-bg"
        role="img"
        aria-label={COST_PARTS.map((p) => `${t(p)} ${Math.round((cost[p] / cost.total) * 100)}%`).join(', ')}
      >
        {COST_PARTS.map((p) => (
          <span key={p} style={{ width: `${(cost[p] / cost.total) * 100}%`, background: PART_COLOR[p] }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-muted">
        {COST_PARTS.map((p) => (
          <li key={p}>
            <i
              aria-hidden
              className="mr-1 inline-block size-2 rounded-sm"
              style={{ background: PART_COLOR[p] }}
            />
            {t(p)} {Math.round((cost[p] / cost.total) * 100)}%
          </li>
        ))}
      </ul>
    </div>
  );
}
