import { describe, expect, test } from 'vitest';
import { buildDeepLink } from '../src/deeplinks/index.js';

const travellers = { adults: 2, childAges: [3, 6] };
const goaStay = { kind: 'hotel' as const, destinationName: 'Goa', checkIn: '2026-12-02', checkOut: '2026-12-09', travellers };

describe('buildDeepLink', () => {
  test('Booking.com pre-fills dates, adults, each child age and rooms', () => {
    const { url, prefilled } = buildDeepLink('booking', goaStay);
    expect(url.startsWith('https://www.booking.com/searchresults.html?')).toBe(true);
    for (const part of ['ss=Goa', 'checkin=2026-12-02', 'checkout=2026-12-09', 'group_adults=2', 'group_children=2', 'age=3', 'age=6', 'no_rooms=1'])
      expect(url).toContain(part);
    expect(prefilled).toBe(true);
  });

  test('Agoda uses length of stay and comma-separated child ages', () => {
    const { url, prefilled } = buildDeepLink('agoda', goaStay);
    expect(url).toContain('checkIn=2026-12-02');
    expect(url).toContain('los=7');
    expect(url).toContain('childages=3%2C6');
    expect(prefilled).toBe(true);
  });

  test('Expedia pre-fills dates and children', () => {
    const { url, prefilled } = buildDeepLink('expedia', goaStay);
    expect(url).toContain('startDate=2026-12-02');
    expect(url).toContain('endDate=2026-12-09');
    expect(url).toContain('children=1_3%2C1_6');
    expect(prefilled).toBe(true);
  });

  test('redBus pre-fills route and date', () => {
    const { url, prefilled } = buildDeepLink('redbus', {
      kind: 'bus',
      fromName: 'Kolkata',
      toName: 'Goa',
      date: '2026-12-01',
      travellers,
    });
    expect(url).toContain('/bus-tickets/kolkata-to-goa');
    expect(url).toContain('doj=01-Dec-2026');
    expect(prefilled).toBe(true);
  });

  test('IRCTC cannot be pre-filled and says so', () => {
    const r = buildDeepLink('irctc', { kind: 'train', fromName: 'Kolkata', toName: 'Goa', date: '2026-12-01', travellers });
    expect(r.url).toBe('https://www.irctc.co.in/nget/train-search');
    expect(r.prefilled).toBe(false);
  });

  test('MakeMyTrip links are not claimed as pre-filled until the format is verified', () => {
    expect(buildDeepLink('makemytrip', goaStay).prefilled).toBe(false);
    expect(
      buildDeepLink('makemytrip', { kind: 'flight', fromName: 'Kolkata', toName: 'Goa', date: '2026-12-01', travellers })
        .prefilled,
    ).toBe(false);
  });

  test('missing required params throw', () => {
    expect(() => buildDeepLink('booking', { ...goaStay, checkOut: undefined })).toThrow(/checkOut/);
    expect(() => buildDeepLink('redbus', { kind: 'bus', fromName: 'Kolkata', travellers })).toThrow(/toName/);
  });
});
