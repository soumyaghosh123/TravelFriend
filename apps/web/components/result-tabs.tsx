'use client';

import { useTranslations } from 'next-intl';

export const TABS = ['dates', 'plan', 'getting', 'hotels', 'local', 'sights', 'food', 'shopping', 'dos', 'cost'] as const;
export type TabId = (typeof TABS)[number];

/** The 10 numbered result tabs (brief §2.2). Tabs whose build step hasn't landed yet are shown disabled. */
export function ResultTabs({ active }: { active: TabId }) {
  const t = useTranslations('results.tabs');
  const tr = useTranslations('results');
  return (
    <div role="tablist" aria-label={tr('tabsLabel')} className="my-5 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:thin]">
      {TABS.map((id, i) => {
        const on = id === active;
        const ready = id === 'dates';
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={!ready}
            title={ready ? undefined : tr('comingSoon')}
            className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 font-semibold ${
              on ? 'border-brand text-brand-d' : 'border-transparent text-muted'
            } disabled:opacity-50`}
          >
            <span
              className={`mr-1.5 inline-grid size-[18px] place-items-center rounded-full text-[10px] ${on ? 'bg-brand text-white' : 'bg-line text-ink2'}`}
            >
              {i + 1}
            </span>
            {t(id)}
          </button>
        );
      })}
    </div>
  );
}
