'use client';

import { useTranslations } from 'next-intl';

export const TABS = [
  'dates',
  'plan',
  'getting',
  'hotels',
  'local',
  'sights',
  'food',
  'shopping',
  'dos',
  'cost',
] as const;
export type TabId = (typeof TABS)[number];

/** Tabs whose build step has landed (PLAN §12). The rest are shown disabled. */
export const READY_TABS: readonly TabId[] = [
  'dates',
  'plan',
  'getting',
  'hotels',
  'local',
  'sights',
  'food',
  'shopping',
  'dos',
  'cost',
];

interface Props {
  active: TabId;
  onChange?: (tab: TabId) => void;
}

export function tabId(id: TabId): string {
  return `tab-${id}`;
}

export function panelId(id: TabId): string {
  return `panel-${id}`;
}

/** The 10 numbered result tabs (brief §2.2). */
export function ResultTabs({ active, onChange }: Props) {
  const t = useTranslations('results.tabs');
  const tr = useTranslations('results');

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = READY_TABS.indexOf(active);
    const next = READY_TABS[(i + (e.key === 'ArrowRight' ? 1 : READY_TABS.length - 1)) % READY_TABS.length]!;
    onChange?.(next);
    document.getElementById(tabId(next))?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={tr('tabsLabel')}
      onKeyDown={onKeyDown}
      className="my-5 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:thin]"
    >
      {TABS.map((id, i) => {
        const on = id === active;
        const ready = READY_TABS.includes(id);
        return (
          <button
            key={id}
            id={tabId(id)}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={ready ? panelId(id) : undefined}
            tabIndex={on ? 0 : -1}
            disabled={!ready}
            title={ready ? undefined : tr('comingSoon')}
            onClick={() => onChange?.(id)}
            className={`whitespace-nowrap border-b-[3px] px-3 py-2.5 font-semibold ${
              on ? 'border-brand text-brand-d' : 'border-transparent text-muted hover:text-ink2'
            } disabled:opacity-50 disabled:hover:text-muted`}
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
