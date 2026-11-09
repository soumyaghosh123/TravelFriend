'use client';

import { DEFAULT_PRICING_RULES, fareTypeForAge, type PlanCost } from '@tripsaver/domain';
import type { PlanCostView, TripStyle } from '@tripsaver/providers';
import { useLocale, useTranslations } from 'next-intl';
import { dateRange } from '../lib/format';
import { BookingChecklist } from './booking-checklist';
import { COST_PARTS, CostSplit } from './cost-split';
import { Price } from './price';

interface Props {
  searchId: string;
  /** Every plan, the selected one at the selected dates. */
  plans: PlanCostView[];
  selected: TripStyle;
  /** "2 adults + 2 children" */
  travellers: string;
  /** For the "who pays what" note (default child rules: under 4 free, 4–7 half, 8+ full). */
  childAges: number[];
}

type Column = {
  id: string;
  style: TripStyle;
  label: string;
  cost: PlanCost;
  view: Extract<PlanCostView, { available: true }>;
};

/** Tab 10 "Total & book" (brief §3.9, PLAN §6.7): every plan's cost by part, and the selected plan's checklist. */
export function CostTab({ searchId, plans, selected, travellers, childAges }: Props) {
  const t = useTranslations('results.cost');
  const tp = useTranslations('results.plans');
  const locale = useLocale();
  const order: TripStyle[] = ['offbeat', 'budget', 'comfort'];
  const columns: Column[] = [];
  for (const style of order) {
    const v = plans.find((p) => p.style === style);
    if (!v?.available) continue;
    columns.push({
      id: style,
      style,
      label: style === 'comfort' && v.fiveStar ? t('comfort3') : tp(`${style}.name`),
      cost: v.cost,
      view: v,
    });
    if (style === 'comfort' && v.fiveStar)
      columns.push({ id: 'comfort5', style, label: t('comfort5'), cost: v.fiveStar, view: v });
  }
  const current = plans.find((p) => p.style === selected);
  const missing = order.filter((s) => !plans.find((p) => p.style === s)?.available);
  const childRule = childAges
    .map((age) => t(`child.${fareTypeForAge(age, 'train', '', DEFAULT_PRICING_RULES).fareType}`, { age }))
    .join(', ');
  const estimateRow = (p: (typeof COST_PARTS)[number]) => p !== 'transport';

  return (
    <div className="space-y-3.5">
      <div className="grid gap-3.5 lg:grid-cols-2">
        <section className="rounded-card bg-white p-4 shadow-card">
          <h3 className="font-bold">
            {current?.available
              ? t('title', { travellers, dates: dateRange(current.start, current.end, locale) })
              : t('titleNoDates', { travellers })}
          </h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-1.5 font-semibold">
                    <span className="sr-only">{t('part')}</span>
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      className={`px-2 py-1.5 text-right font-semibold ${c.id === selected ? 'bg-brand-xl text-brand-d' : ''}`}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COST_PARTS.map((p) => (
                  <tr key={p} className="border-t border-line">
                    <th scope="row" className="py-1.5 text-left font-normal">
                      {t(`rows.${p}`)}
                      {estimateRow(p) && (
                        <span className="ml-1 text-[10px] font-bold uppercase text-warn">{t('est')}</span>
                      )}
                    </th>
                    {columns.map((c) => (
                      <td
                        key={c.id}
                        className={`px-2 py-1.5 text-right ${c.id === selected ? 'bg-brand-xl' : ''}`}
                      >
                        <Price amount={c.cost[p]} isEstimate={false} size="sm" />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="border-t-2 border-ink font-bold">
                  <th scope="row" className="py-2 text-left">
                    {t('total')}
                  </th>
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={`px-2 py-2 text-right ${c.id === selected ? 'bg-brand-xl' : ''}`}
                    >
                      <Price
                        amount={c.cost.total}
                        isEstimate
                        size="sm"
                        sources={{ names: c.view.sources, fetchedAt: c.view.fetchedAt }}
                      />
                    </td>
                  ))}
                </tr>
                <tr className="text-muted">
                  <th scope="row" className="py-1.5 text-left font-normal">
                    {t('perPerson', { people: columns[0]?.cost.people ?? 0 })}
                  </th>
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={`px-2 py-1.5 text-right ${c.id === selected ? 'bg-brand-xl' : ''}`}
                    >
                      <Price amount={c.cost.perPerson} isEstimate={false} size="sm" />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {current?.available && <CostSplit cost={current.cost} />}
          <p className="mt-3 rounded-[10px] bg-bg px-3 py-2 text-xs text-ink2">
            {childAges.length ? t('rule', { travellers, childRule }) : t('ruleAdults', { travellers })}{' '}
            {t('reconcile')}
          </p>
          {missing.length > 0 && (
            <p className="mt-2 text-xs text-muted">
              {t('missing', { plans: missing.map((s) => tp(`${s}.name`)).join(', ') })}
            </p>
          )}
        </section>

        <section className="rounded-card bg-white p-4 shadow-card">
          <h3 className="font-bold">{t('checkTitle', { plan: tp(`${selected}.name`) })}</h3>
          {current?.available ? (
            <BookingChecklist
              searchId={searchId}
              style={selected}
              start={current.start}
              items={current.checklist}
              travellers={travellers}
            />
          ) : (
            <p className="mt-2 text-sm text-muted">{t('noPlan')}</p>
          )}
        </section>
      </div>
      <p className="text-xs text-muted">
        {current?.available && current.sampleData && <b className="text-warn">{t('sample')} </b>}
        {t('disclaimer')}
      </p>
    </div>
  );
}
