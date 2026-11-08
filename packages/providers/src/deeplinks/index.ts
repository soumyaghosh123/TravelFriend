import { diffDays, suggestRooms, type ISODate, type Travellers } from '@tripsaver/domain';

export type SiteId = 'irctc' | 'redbus' | 'makemytrip' | 'goibibo' | 'booking' | 'agoda' | 'expedia';

export const SITE_NAMES: Record<SiteId, string> = {
  irctc: 'IRCTC',
  redbus: 'redBus',
  makemytrip: 'MakeMyTrip',
  goibibo: 'Goibibo',
  booking: 'Booking.com',
  agoda: 'Agoda',
  expedia: 'Expedia',
};

export interface DeepLinkParams {
  kind: 'hotel' | 'train' | 'bus' | 'flight';
  fromName?: string;
  toName?: string;
  fromCode?: string;
  toCode?: string;
  destinationName?: string;
  date?: ISODate;
  checkIn?: ISODate;
  checkOut?: ISODate;
  travellers: Travellers;
  rooms?: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function need<K extends keyof DeepLinkParams>(p: DeepLinkParams, key: K): NonNullable<DeepLinkParams[K]> {
  const v = p[key];
  if (v === undefined || v === null || v === '') throw new Error(`Deep link needs "${String(key)}" for ${p.kind}`);
  return v as NonNullable<DeepLinkParams[K]>;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function url(base: string, params: [string, string | number][]): string {
  const q = new URLSearchParams();
  for (const [k, v] of params) q.append(k, String(v));
  return `${base}?${q.toString()}`;
}

/**
 * Booking links with dates and travellers pre-filled where the site supports it.
 * `prefilled: false` means the user must re-enter details on the site; the UI says so.
 * MakeMyTrip / Goibibo formats are unverified, so they are not claimed as pre-filled.
 */
export function buildDeepLink(site: SiteId, p: DeepLinkParams): { url: string; prefilled: boolean } {
  const t = p.travellers;
  if (p.kind === 'hotel') {
    const dest = need(p, 'destinationName');
    const checkIn = need(p, 'checkIn');
    const checkOut = need(p, 'checkOut');
    const rooms = p.rooms ?? suggestRooms(t);
    switch (site) {
      case 'booking':
        return {
          url: url('https://www.booking.com/searchresults.html', [
            ['ss', dest],
            ['checkin', checkIn],
            ['checkout', checkOut],
            ['group_adults', t.adults],
            ['group_children', t.childAges.length],
            ['no_rooms', rooms],
            ...t.childAges.map((a): [string, number] => ['age', a]),
          ]),
          prefilled: true,
        };
      case 'agoda':
        return {
          url: url('https://www.agoda.com/search', [
            ['textToSearch', dest],
            ['checkIn', checkIn],
            ['los', diffDays(checkIn, checkOut)],
            ['adults', t.adults],
            ['children', t.childAges.length],
            ['childages', t.childAges.join(',')],
            ['rooms', rooms],
          ]),
          prefilled: true,
        };
      case 'expedia':
        return {
          url: url('https://www.expedia.co.in/Hotel-Search', [
            ['destination', dest],
            ['startDate', checkIn],
            ['endDate', checkOut],
            ['adults', t.adults],
            ['children', t.childAges.map((a) => `1_${a}`).join(',')],
          ]),
          prefilled: true,
        };
      case 'makemytrip':
        return { url: url('https://www.makemytrip.com/hotels/', [['city', dest]]), prefilled: false };
      case 'goibibo':
        return { url: url('https://www.goibibo.com/hotels/', [['city', dest]]), prefilled: false };
      default:
        throw new Error(`${site} does not sell hotels`);
    }
  }

  const fromName = need(p, 'fromName');
  const toName = need(p, 'toName');
  const date = need(p, 'date');
  switch (site) {
    case 'irctc':
      return { url: 'https://www.irctc.co.in/nget/train-search', prefilled: false };
    case 'redbus': {
      const [y, m, d] = date.split('-');
      const doj = `${d}-${MONTHS[Number(m) - 1]}-${y}`;
      return {
        url: `https://www.redbus.in/bus-tickets/${slug(fromName)}-to-${slug(toName)}?doj=${doj}`,
        prefilled: true,
      };
    }
    case 'makemytrip':
      return { url: 'https://www.makemytrip.com/flights/', prefilled: false };
    case 'goibibo':
      return { url: 'https://www.goibibo.com/flights/', prefilled: false };
    default:
      throw new Error(`${site} does not sell ${p.kind} tickets`);
  }
}
