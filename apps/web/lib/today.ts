/** Today's calendar date in India (`YYYY-MM-DD`). Matches the API's notion of "today". */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}
