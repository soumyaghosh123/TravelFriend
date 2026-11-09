import { addDays } from '../dates.js';
import type { ISODate } from '../types.js';

/**
 * A calendar entry: all-day (`date`) or timed (`start` / `end` as local `YYYY-MM-DDTHH:MM`).
 * Times are written as local ("floating") times, as the trip is planned in local dates (CLAUDE.md).
 */
export type IcsEvent = { uid: string; title: string; description?: string; location?: string } & (
  { date: ISODate; start?: never; end?: never } | { start: string; end: string; date?: never }
);

const compactDate = (d: ISODate) => d.replaceAll('-', '');
const compactLocal = (t: string) => `${compactDate(t.slice(0, 10))}T${t.slice(11, 13)}${t.slice(14, 16)}00`;

/** RFC 5545 §3.3.11 text escaping. */
function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** RFC 5545 §3.1: lines of at most 75 octets; continuation lines start with one space. Never splits a character. */
function fold(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // the leading space counts
    if (bytes + n > limit) {
      out.push(out.length === 0 ? cur : ` ${cur}`);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(out.length === 0 ? cur : ` ${cur}`);
  return out;
}

/** The trip as an .ics file (works with Google Calendar import, Apple Calendar and Outlook). `now` is an ISO instant. */
export function buildIcs(calendarName: string, events: IcsEvent[], now: string): string {
  const stamp = `${now.slice(0, 19).replace(/[-:]/g, '')}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TripSaver//Trip plan//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}@tripsaver`, `DTSTAMP:${stamp}`);
    if (e.date !== undefined)
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(e.date)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(e.date, 1))}`,
      );
    else lines.push(`DTSTART:${compactLocal(e.start)}`, `DTEND:${compactLocal(e.end)}`);
    lines.push(`SUMMARY:${escapeText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(fold).join('\r\n') + '\r\n';
}

/** "Add to Google Calendar" link for the whole trip as one all-day event (the end date is exclusive). */
export function googleCalendarUrl(e: {
  title: string;
  start: ISODate;
  endInclusive: ISODate;
  details?: string;
}): string {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compactDate(e.start)}/${compactDate(addDays(e.endInclusive, 1))}`,
  });
  if (e.details) q.set('details', e.details);
  return `https://calendar.google.com/calendar/render?${q}`;
}
