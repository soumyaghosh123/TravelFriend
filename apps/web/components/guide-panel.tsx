'use client';

import type { FoodPref, MonthClimate, PlanStyle } from '@tripsaver/domain';
import type { DatesSection, GuideSection, ItinerarySection } from '@tripsaver/providers';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { guideAnchors } from '../lib/guide-anchor';
import { DosDontsTab } from './dos-donts-tab';
import { FoodTab } from './food-tab';
import { Segmented } from './segmented';
import { ShoppingTab } from './shopping-tab';
import { SightsTab } from './sights-tab';

export type GuideTab = 'sights' | 'food' | 'shopping' | 'dos';

interface Props {
  tab: GuideTab;
  guide: GuideSection;
  /** The current plan, so distances are from its hotel and sights it visits are marked. */
  plan?: ItinerarySection | null;
  style: PlanStyle;
  food?: FoodPref;
  trip?: { start: string; end: string };
  climate?: MonthClimate | null;
  climateSource?: DatesSection['climateSource'];
}

/**
 * Tabs 6–9 (sightseeing, food, shopping, do's & don'ts) for one destination. For a split stay you
 * pick the base, and distances are measured from that base's hotel.
 */
export function GuidePanel({
  tab,
  guide,
  plan = null,
  style,
  food = 'any',
  trip,
  climate,
  climateSource = null,
}: Props) {
  const t = useTranslations('results.guide');
  const anchors = useMemo(() => guideAnchors(guide, plan), [guide, plan]);
  const [anchorId, setAnchorId] = useState(anchors[0]!.id);
  const anchor = anchors.find((a) => a.id === anchorId) ?? anchors[0]!;
  const base = plan?.available ? plan.bases.find((b) => b.id === anchor.id) : undefined;
  const inPlan = useMemo(
    () =>
      new Set(
        plan?.available
          ? plan.days.flatMap((d) => d.stops.map((s) => s.attractionId).filter((x): x is string => !!x))
          : [],
      ),
    [plan],
  );

  const picker = anchors.length > 1 && (
    <Segmented
      label={t('baseLabel')}
      value={anchor.id}
      options={anchors.map((a) => ({
        id: a.id,
        label: plan?.available ? (plan.bases.find((b) => b.id === a.id)?.name ?? a.name) : a.name,
      }))}
      onChange={setAnchorId}
    />
  );

  const content = guide.guide;
  const body =
    tab === 'sights' ? (
      <SightsTab guide={guide} anchor={anchor} inPlan={inPlan} />
    ) : tab === 'food' && (content || guide.restaurants.list.length > 0) ? (
      // Real places (OpenStreetMap) show even where we haven't written a guide yet.
      <FoodTab
        guide={guide}
        content={content}
        anchor={anchor}
        style={style}
        food={food}
        hotel={base?.hotel ?? null}
      />
    ) : !content ? (
      <p className="rounded-card bg-white p-4 text-muted shadow-card">{t('noContent')}</p>
    ) : tab === 'shopping' ? (
      <ShoppingTab guide={guide} content={content} anchor={anchor} {...(trip ? { trip } : {})} />
    ) : (
      <DosDontsTab
        guide={guide}
        content={content}
        anchor={anchor}
        climate={climate ?? null}
        climateSource={climateSource}
      />
    );

  return (
    <div className="space-y-3.5">
      {picker}
      {body}
    </div>
  );
}
