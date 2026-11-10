import { addDays, type ISODate } from '@tripsaver/domain';

/** One cached fare from the Travelpayouts (Aviasales) Flight Data API, in local times. */
export interface TpFare {
  date: ISODate;
  /** Local "YYYY-MM-DDTHH:mm" at the departure airport. */
  departAt: string;
  arriveAt: string;
  arriveDate: ISODate;
  airline: string;
  flightNumber?: string;
  originAirport: string;
  destinationAirport: string;
  /** One adult, one way, INR. */
  price: number;
  durationMin: number;
  transfers: number;
}

const LOCAL = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Reads a `/aviasales/v3/prices_for_dates` reply. Times keep the airport's local clock (the API sends
 * "+05:30" offsets); arrival = departure + duration, so it is in the departure zone (fine inside India).
 * Throws when the reply is a refusal or has no data list.
 */
export function parseTravelpayouts(body: unknown): TpFare[] {
  const b = body as { success?: boolean; error?: unknown; data?: unknown };
  if (!b || b.success === false || !Array.isArray(b.data))
    throw new Error(`Travelpayouts: ${typeof b?.error === 'string' ? b.error : 'unexpected reply'}`);
  const out: TpFare[] = [];
  for (const raw of b.data as Record<string, unknown>[]) {
    const m = typeof raw.departure_at === 'string' ? LOCAL.exec(raw.departure_at) : null;
    const price = raw.price;
    const duration = Number(raw.duration_to ?? raw.duration);
    if (!m || typeof price !== 'number' || !Number.isInteger(price) || price <= 0) continue;
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const date = m[1] as ISODate;
    const depart = Number(m[2]) * 60 + Number(m[3]);
    const end = depart + duration;
    const arriveDate = addDays(date, Math.floor(end / 1440));
    out.push({
      date,
      departAt: `${date}T${m[2]}:${m[3]}`,
      arriveAt: `${arriveDate}T${pad(Math.floor((end % 1440) / 60))}:${pad(end % 60)}`,
      arriveDate,
      airline: String(raw.airline ?? ''),
      ...(raw.flight_number ? { flightNumber: String(raw.flight_number) } : {}),
      originAirport: String(raw.origin_airport ?? raw.origin ?? ''),
      destinationAirport: String(raw.destination_airport ?? raw.destination ?? ''),
      price,
      durationMin: duration,
      transfers: Number(raw.transfers ?? 0),
    });
  }
  return out;
}
