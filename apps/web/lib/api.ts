import type { SearchInput, SearchInputIssue, ValidSearchInput } from '@tripsaver/domain';
import type { GuideSection, ItinerarySection, PlanCostView, WindowDetail } from '@tripsaver/providers';
import type { PlaceOption } from './search-form-state';

/** Server components call the API directly; the browser goes through the /api rewrite. */
function base(): string {
  return typeof window === 'undefined' ? (process.env.API_URL ?? 'http://localhost:4000') : '';
}

export async function suggestPlaces(q: string, signal?: AbortSignal): Promise<PlaceOption[]> {
  const res = await fetch(`${base()}/api/places?q=${encodeURIComponent(q)}`, { signal, cache: 'no-store' });
  if (!res.ok) throw new Error(`places ${res.status}`);
  return (await res.json()) as PlaceOption[];
}

/** Resolves exact place codes (for URL prefill). Unknown codes are dropped. */
export async function placeByCode(code: string): Promise<PlaceOption | null> {
  try {
    const list = await suggestPlaces(code);
    return list.find((p) => p.code === code) ?? null;
  } catch {
    return null;
  }
}

export type CreateSearchResult =
  { ok: true; searchId: string } | { ok: false; issues: SearchInputIssue[] } | { ok: false; network: true };

export async function createSearch(input: SearchInput): Promise<CreateSearchResult> {
  let res: Response;
  try {
    res = await fetch(`${base()}/api/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
  } catch {
    return { ok: false, network: true };
  }
  if (res.status === 201)
    return { ok: true, searchId: ((await res.json()) as { searchId: string }).searchId };
  if (res.status === 400) {
    const body = (await res.json()) as { issues?: SearchInputIssue[] };
    return { ok: false, issues: body.issues ?? [{ path: '', message: 'unknown' }] };
  }
  return { ok: false, network: true };
}

export interface StoredSearch {
  id: string;
  input: ValidSearchInput;
  createdAt: string;
}

export async function getSearch(id: string): Promise<StoredSearch | null> {
  const res = await fetch(`${base()}/api/search/${encodeURIComponent(id)}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`search ${res.status}`);
  return (await res.json()) as StoredSearch;
}

/** Destination guide for `/destination/[slug]` (server side). Null when we have no guide for it. */
export async function getGuide(code: string): Promise<GuideSection | null> {
  const res = await fetch(`${base()}/api/destinations/${encodeURIComponent(code)}/guide`, {
    next: { revalidate: 3600 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`guide ${res.status}`);
  return (await res.json()) as GuideSection;
}

async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(`${base()}${path}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

/** Everything the printable plan needs for one plan and start date (server side); null if any part is missing. */
export async function getPlanForPrint(
  id: string,
  style: string,
  start: string,
): Promise<{ window: WindowDetail['window']; plan: ItinerarySection; cost: PlanCostView } | null> {
  const q = `?${new URLSearchParams({ style, start })}`;
  const sid = encodeURIComponent(id);
  const [w, plan, cost] = await Promise.all([
    getJson<WindowDetail>(`/api/search/${sid}/window${q}`),
    getJson<ItinerarySection>(`/api/search/${sid}/itinerary${q}`),
    getJson<PlanCostView>(`/api/search/${sid}/cost${q}`),
  ]);
  return w && plan && cost ? { window: w.window, plan, cost } : null;
}
