import type { ValidSearchInput } from '@tripsaver/domain';

/** Browser-side calls to the account API (same origin, so the session cookie goes along). */

export interface Me {
  email: string | null;
  name: string | null;
}

export interface SavedTrip {
  id: string;
  searchId: string | null;
  title: string | null;
  style: string;
  start: string;
  inputs: ValidSearchInput;
  createdAt: string;
  updatedAt: string;
}

const json = { 'content-type': 'application/json' };

export async function fetchMe(): Promise<Me | null> {
  const res = await fetch('/api/auth/me', { cache: 'no-store' });
  if (!res.ok) return null;
  return ((await res.json()) as { user: Me | null }).user;
}

export async function authConfig(): Promise<{ google: boolean }> {
  const res = await fetch('/api/auth/config');
  return res.ok ? ((await res.json()) as { google: boolean }) : { google: false };
}

export async function requestLink(
  email: string,
  next: string,
  locale: string,
): Promise<'sent' | 'invalid' | 'busy' | 'error'> {
  try {
    const res = await fetch('/api/auth/email', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email, next, locale }),
    });
    if (res.status === 204) return 'sent';
    if (res.status === 400) return 'invalid';
    if (res.status === 429) return 'busy';
    return 'error';
  } catch {
    return 'error';
  }
}

export async function verifyLink(token: string): Promise<boolean> {
  const res = await fetch('/api/auth/email/verify', {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ token }),
  });
  return res.ok;
}

export async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' });
}

/** Null when not signed in. */
export async function listTrips(): Promise<SavedTrip[] | null> {
  const res = await fetch('/api/me/trips', { cache: 'no-store' });
  if (res.status === 401) return null;
  if (!res.ok) throw new Error(`trips ${res.status}`);
  return (await res.json()) as SavedTrip[];
}

export async function saveTrip(body: {
  searchId: string;
  style: string;
  start: string;
  title?: string;
}): Promise<SavedTrip | 'signin'> {
  const res = await fetch('/api/me/trips', { method: 'POST', headers: json, body: JSON.stringify(body) });
  if (res.status === 401) return 'signin';
  if (!res.ok) throw new Error(`save ${res.status}`);
  return (await res.json()) as SavedTrip;
}

export async function deleteTrip(id: string): Promise<void> {
  const res = await fetch(`/api/me/trips/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete ${res.status}`);
}

export async function openTrip(
  id: string,
): Promise<{ searchId: string; style: string; start: string } | 'past'> {
  const res = await fetch(`/api/me/trips/${encodeURIComponent(id)}/open`, { method: 'POST' });
  if (res.status === 410) return 'past';
  if (!res.ok) throw new Error(`open ${res.status}`);
  return (await res.json()) as { searchId: string; style: string; start: string };
}

export async function bookedOnServer(tripId: string): Promise<string[]> {
  const res = await fetch(`/api/me/trips/${encodeURIComponent(tripId)}/booked`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`booked ${res.status}`);
  return (await res.json()) as string[];
}

export async function setBookedOnServer(tripId: string, itemKey: string, booked: boolean): Promise<void> {
  await fetch(`/api/me/trips/${encodeURIComponent(tripId)}/booked/${encodeURIComponent(itemKey)}`, {
    method: 'PUT',
    headers: json,
    body: JSON.stringify({ booked }),
  });
}

/** Where to go to sign in and come back to this page afterwards. */
export function signInHref(next: string): string {
  return `/account?${new URLSearchParams({ next })}`;
}
