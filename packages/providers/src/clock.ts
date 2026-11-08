/** Source of "now", injected so `fetchedAt` is testable. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function fixedClock(iso: string): Clock {
  const ms = new Date(iso).getTime();
  return () => new Date(ms);
}
