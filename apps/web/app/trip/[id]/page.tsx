import type { TripStyle } from '@tripsaver/providers';
import { notFound } from 'next/navigation';
import type { TabId } from '../../../components/result-tabs';
import { ResultsView } from '../../../components/results-view';
import { SiteFooter } from '../../../components/site-footer';
import { SiteHeader } from '../../../components/site-header';
import { getSearch, placeByCode } from '../../../lib/api';
import { prefillQuery } from '../../../lib/search-form-state';

const STYLES: TripStyle[] = ['offbeat', 'budget', 'comfort'];
// Kept here (not imported from the client tabs module) so the server can check it.
const TABS: TabId[] = [
  'dates',
  'plan',
  'getting',
  'hotels',
  'local',
  'sights',
  'food',
  'shopping',
  'dos',
  'cost',
];

/** Results page (PLAN §9): sections stream in over SSE and fill the tabs as they arrive. */
export default async function TripPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string; start?: string; tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const search = await getSearch(id);
  if (!search) notFound();
  const { input } = search;
  const [from, to] = await Promise.all([placeByCode(input.from), placeByCode(input.to)]);

  return (
    <>
      <SiteHeader />
      <ResultsView
        searchId={id}
        input={input}
        fromName={from?.name ?? input.from}
        toName={to?.name ?? input.to}
        toKind={to?.kind ?? 'city'}
        changeHref={`/?${prefillQuery(input)}#search`}
        initial={{
          ...(STYLES.includes(sp.plan as TripStyle) ? { style: sp.plan as TripStyle } : {}),
          ...(sp.start && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? { start: sp.start } : {}),
          ...(TABS.includes(sp.tab as TabId) ? { tab: sp.tab as TabId } : {}),
        }}
      />
      <SiteFooter />
    </>
  );
}
