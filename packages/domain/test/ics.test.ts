import { describe, expect, test } from 'vitest';
import { buildIcs, googleCalendarUrl, type IcsEvent } from '../src/export/ics.js';

const now = '2026-11-09T10:30:00Z';
const events: IcsEvent[] = [
  {
    uid: 'trip-1-day-1',
    title: 'Day 1 · Travel',
    date: '2026-12-01',
    description: '07:15 Onward train 18047, 3A',
  },
  {
    uid: 'trip-1-onward',
    title: 'Train 18047 Kolkata → Goa',
    start: '2026-12-01T07:15',
    end: '2026-12-02T09:40',
    location: 'Howrah → Madgaon',
  },
];

const lines = (ics: string) => ics.split('\r\n');

describe('buildIcs (RFC 5545)', () => {
  test('a VCALENDAR with one VEVENT per event, CRLF line endings, a stamp and unique ids', () => {
    const ics = buildIcs('TripSaver · Goa', events, now);
    const l = lines(ics);
    expect(l[0]).toBe('BEGIN:VCALENDAR');
    expect(l).toContain('VERSION:2.0');
    expect(l).toContain('PRODID:-//TripSaver//Trip plan//EN');
    expect(l).toContain('X-WR-CALNAME:TripSaver · Goa');
    expect(l.filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(2);
    expect(l).toContain('UID:trip-1-day-1@tripsaver');
    expect(l).toContain('DTSTAMP:20261109T103000Z');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  test('all-day events end the next day; timed events use local (floating) times', () => {
    const l = lines(buildIcs('t', events, now));
    expect(l).toContain('DTSTART;VALUE=DATE:20261201');
    expect(l).toContain('DTEND;VALUE=DATE:20261202');
    expect(l).toContain('DTSTART:20261201T071500');
    expect(l).toContain('DTEND:20261202T094000');
    expect(l).toContain('LOCATION:Howrah → Madgaon');
  });

  test('escapes commas, semicolons, backslashes and new lines in text', () => {
    const ics = buildIcs(
      't',
      [{ uid: 'x', title: 'Fort; beach, café\\bar', date: '2026-12-03', description: 'line 1\nline 2' }],
      now,
    );
    expect(ics).toContain('SUMMARY:Fort\\; beach\\, café\\\\bar');
    expect(ics).toContain('DESCRIPTION:line 1\\nline 2');
  });

  test('folds lines longer than 75 octets (UTF-8), continuation lines start with a space', () => {
    const long = 'Basilica of Bom Jesus · Se Cathedral · Fontainhas · ' + 'é'.repeat(80);
    const l = lines(buildIcs('t', [{ uid: 'x', title: long, date: '2026-12-03' }], now));
    for (const x of l) expect(Buffer.byteLength(x, 'utf8')).toBeLessThanOrEqual(75);
    const i = l.findIndex((x) => x.startsWith('SUMMARY:'));
    expect(l[i + 1]!.startsWith(' ')).toBe(true);
    // Unfolding gives the original text back.
    const unfolded = buildIcs('t', [{ uid: 'x', title: long, date: '2026-12-03' }], now).replace(
      /\r\n /g,
      '',
    );
    expect(unfolded).toContain(`SUMMARY:${long}`);
  });
});

describe('googleCalendarUrl', () => {
  test('an all-day trip event; the end date is exclusive', () => {
    const u = new URL(
      googleCalendarUrl({
        title: 'Goa trip',
        start: '2026-12-01',
        endInclusive: '2026-12-10',
        details: 'Plan: https://example.test/trip/1',
      }),
    );
    expect(u.origin + u.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(u.searchParams.get('action')).toBe('TEMPLATE');
    expect(u.searchParams.get('text')).toBe('Goa trip');
    expect(u.searchParams.get('dates')).toBe('20261201/20261211');
    expect(u.searchParams.get('details')).toContain('https://example.test/trip/1');
  });
});
