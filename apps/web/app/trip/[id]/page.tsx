import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { SiteFooter } from '../../../components/site-footer';
import { SiteHeader } from '../../../components/site-header';
import { getSearch, placeByCode } from '../../../lib/api';
import { inr, monthLabel } from '../../../lib/format';
import { prefillQuery } from '../../../lib/search-form-state';

/** Results page placeholder: confirms the saved search. Price calendar and plans arrive in build step 3+. */
export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const search = await getSearch(id);
  if (!search) notFound();

  const t = await getTranslations('trip');
  const ts = await getTranslations('search');
  const locale = await getLocale();
  const { input } = search;
  const [from, to] = await Promise.all([placeByCode(input.from), placeByCode(input.to)]);
  const p = input.preferences ?? {};

  const prefs = [
    p.stayNear && `${ts('stayNear')}: ${p.stayNear}`,
    // The user's own budget, not a fetched price, so it doesn't go through <Price>.
    p.budget !== undefined && `${ts('budget')}: ${inr(p.budget)}`,
    p.travelMode && `${ts('travelMode')}: ${ts(`modes.${p.travelMode}`)}`,
    p.ac && ts(`acOptions.${p.ac}`),
    p.berth && ts(`berthOptions.${p.berth}`),
    p.food && `${ts('food')}: ${ts(`foodOptions.${p.food}`)}`,
    p.companions?.length && `${ts('with')}: ${p.companions.map((c) => ts(`companions.${c}`)).join(', ')}`,
    p.interests?.length && `${ts('interests')}: ${p.interests.map((i) => ts(`interestOptions.${i}`)).join(', ')}`,
  ].filter(Boolean);

  return (
    <>
      <SiteHeader />
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-line bg-white px-3.5 py-2.5 md:gap-4 md:px-6">
        <div>
          <div className="text-[15px] font-bold">{t('title', { from: from?.name ?? input.from, to: to?.name ?? input.to })}</div>
          <div className="text-[13px] text-muted">
            {t('meta', { days: input.days, month: monthLabel(input.month, locale) })} ·{' '}
            {ts('travellersSummary', { adults: input.travellers.adults, children: input.travellers.childAges.length })} ·{' '}
            {ts('roomsSummary', { rooms: input.travellers.rooms })}
          </div>
        </div>
        <div className="flex-1" />
        <Link href={`/?${prefillQuery(input)}#search`} className="rounded-full border border-line bg-white px-3 py-1.5 font-medium text-ink2 hover:border-brand">
          {t('changeSearch')}
        </Link>
      </div>

      <main className="mx-auto max-w-[1232px] px-3.5 py-[18px] md:px-6">
        <section className="rounded-card bg-white p-4 shadow-card">
          <h1 className="text-lg font-bold">{t('building')}</h1>
          <p className="mt-1 text-muted">{t('buildingBody')}</p>
          <h2 className="mt-4 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{t('searchedFor')}</h2>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted">{ts('travellers')}</dt>
            <dd>
              {ts('travellersSummary', { adults: input.travellers.adults, children: input.travellers.childAges.length })}
              {input.travellers.childAges.length > 0 &&
                ` (${input.travellers.childAges.map((a) => ts('ageYears', { age: a })).join(', ')})`}
            </dd>
            <dt className="text-muted">{t('hotelTypes')}</dt>
            <dd>{input.hotelTypes.map((h) => ts(`hotelTypes.${h}`)).join(', ')}</dd>
            <dt className="text-muted">{t('preferences')}</dt>
            <dd>{prefs.length ? prefs.join(' · ') : t('none')}</dd>
          </dl>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
