/**
 * Display details for destinations with mock data (Milestone 1). Photos are the approved mockup's
 * Unsplash placeholders; production uses licensed images on our CDN with credits (PLAN §9.1).
 */
export interface DestinationLook {
  code: string;
  name: string;
  kind: 'city' | 'region';
  color: string;
  photo: string;
}

export const DESTINATIONS: DestinationLook[] = [
  { code: 'GOA', name: 'Goa', kind: 'region', color: '#0ea5e9', photo: 'photo-1512343879784-a960bf40e7f2' },
  {
    code: 'MANALI',
    name: 'Manali',
    kind: 'city',
    color: '#64748b',
    photo: 'photo-1626621341517-bbf3d9990a23',
  },
  {
    code: 'JAIPUR',
    name: 'Jaipur',
    kind: 'city',
    color: '#f97316',
    photo: 'photo-1477587458883-47145ed94245',
  },
  {
    code: 'KERALA',
    name: 'Kerala',
    kind: 'region',
    color: '#16a34a',
    photo: 'photo-1602216056096-3b40cc0c9944',
  },
  {
    code: 'DARJEELING',
    name: 'Darjeeling',
    kind: 'city',
    color: '#334155',
    photo: 'photo-1622308644420-b20142dc993c',
  },
];

export function photoUrl(photo: string, width: number): string {
  return `https://images.unsplash.com/${photo}?w=${width}&q=70`;
}

export function destinationLook(code: string): DestinationLook | undefined {
  return DESTINATIONS.find((d) => d.code === code);
}
