import { notFound } from 'next/navigation';
import { ResultsView } from '../../../components/results-view';
import { SiteFooter } from '../../../components/site-footer';
import { SiteHeader } from '../../../components/site-header';
import { getSearch, placeByCode } from '../../../lib/api';
import { prefillQuery } from '../../../lib/search-form-state';

/** Results page (PLAN §9): sections stream in over SSE and fill the tabs as they arrive. */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
      />
      <SiteFooter />
    </>
  );
}
