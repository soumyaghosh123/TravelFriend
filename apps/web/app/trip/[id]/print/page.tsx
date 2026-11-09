import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PrintButton } from '../../../../components/print-button';
import { TripPrintout } from '../../../../components/trip-printout';
import { getPlanForPrint, getSearch, placeByCode } from '../../../../lib/api';

const STYLES = ['offbeat', 'budget', 'comfort'] as const;
type Style = (typeof STYLES)[number];

export const metadata: Metadata = { robots: { index: false } };

/**
 * Printable plan (PLAN §12 step 10). "Download PDF" opens this page and the browser's print dialog,
 * where "Save as PDF" makes the file; it is built from the same API data as the results tabs.
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ plan?: string; start?: string; autoprint?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const style: Style = STYLES.includes(sp.plan as Style) ? (sp.plan as Style) : 'budget';
  if (!sp.start || !/^\d{4}-\d{2}-\d{2}$/.test(sp.start)) notFound();
  const [search, data] = await Promise.all([getSearch(id), getPlanForPrint(id, style, sp.start)]);
  if (!search || !data || !data.plan.available || !data.cost.available) notFound();
  const { input } = search;
  const [from, to] = await Promise.all([placeByCode(input.from), placeByCode(input.to)]);
  const ts = await getTranslations('search');

  return (
    <main className="min-h-screen bg-bg print:bg-white">
      <PrintButton
        auto={sp.autoprint === '1'}
        backHref={`/trip/${encodeURIComponent(id)}?${new URLSearchParams({ plan: style, start: sp.start })}`}
      />
      <TripPrintout
        plan={data.plan}
        window={data.window}
        cost={data.cost}
        style={style}
        fromName={from?.name ?? input.from}
        toName={to?.name ?? input.to}
        travellers={ts('travellersSummary', {
          adults: input.travellers.adults,
          children: input.travellers.childAges.length,
        })}
      />
    </main>
  );
}
