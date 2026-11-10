import type { GuideSection } from '@tripsaver/providers';

/**
 * Guide pages cache the guide for an hour, so right after a deploy a guide saved before the
 * `restaurants` block existed can still arrive. Treat it as "sample places, not live" instead of
 * crashing the page.
 */
export function withRestaurants(guide: GuideSection): GuideSection {
  if (guide.restaurants) return guide;
  return {
    ...guide,
    restaurants: {
      list: guide.guide?.restaurants ?? [],
      live: false,
      realProvider: false,
      source: null,
      fetchedAt: null,
    },
  };
}
