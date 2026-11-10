/** Source of "now", injected so `fetchedAt` is testable. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function fixedClock(iso: string): Clock {
  const ms = new Date(iso).getTime();
  return () => new Date(ms);
}

/** The date in India (UTC+05:30) at this moment, YYYY-MM-DD. */
export function indiaDate(d: Date): string {
  return new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
