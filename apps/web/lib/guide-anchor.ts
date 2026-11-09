import type { GuideSection, ItinerarySection } from '@tripsaver/providers';

/** Where the guide tabs measure distances from: the plan's hotel at a base, or the main area. */
export interface GuideAnchor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  isHotel: boolean;
}

/** One anchor per base of the plan (its hotel when known); the destination's main area when there is no plan. */
export function guideAnchors(guide: GuideSection, plan: ItinerarySection | null): GuideAnchor[] {
  if (plan?.available && plan.bases.length > 0) {
    return plan.bases.map((b) =>
      b.hotel
        ? { id: b.id, name: b.hotel.name, lat: b.hotel.lat, lng: b.hotel.lng, isHotel: true }
        : { id: b.id, name: b.name, lat: b.lat, lng: b.lng, isHotel: false },
    );
  }
  return [
    {
      id: 'main',
      name: guide.mainArea.name,
      lat: guide.mainArea.lat,
      lng: guide.mainArea.lng,
      isHotel: false,
    },
  ];
}
