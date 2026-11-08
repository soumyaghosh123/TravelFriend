import { HeroSlideshow } from '../components/hero-slideshow';
import { PopularDestinations } from '../components/popular-destinations';
import { SearchForm } from '../components/search-form';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { TrustSection } from '../components/trust-section';
import { placeByCode } from '../lib/api';
import { defaultFormState, parsePrefill, type SearchFormState } from '../lib/search-form-state';
import { todayInIndia } from '../lib/today';
import { initialTravellers } from '../lib/travellers';

type SearchParams = Record<string, string | string[] | undefined>;

async function initialState(params: SearchParams, today: string): Promise<SearchFormState> {
  const p = parsePrefill(params);
  const base = defaultFormState(today);
  const [from, to] = await Promise.all([p.from ? placeByCode(p.from) : null, p.to ? placeByCode(p.to) : null]);
  return {
    ...base,
    from,
    to,
    days: p.days ?? base.days,
    month: p.month && p.month >= today.slice(0, 7) ? p.month : base.month,
    hotelTypes: p.hotelTypes ?? base.hotelTypes,
    travellers: p.adults || p.childAges ? initialTravellers(p.adults ?? 2, p.childAges ?? [], p.rooms) : base.travellers,
  };
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const today = todayInIndia();
  const initial = await initialState(params, today);
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === 'string' && k !== 'to' ? [[k, v]] : [])),
  ).toString();

  return (
    <>
      <SiteHeader />
      <main>
        <HeroSlideshow />
        <SearchForm initial={initial} today={today} />
        <PopularDestinations query={query} />
        <TrustSection />
      </main>
      <SiteFooter />
    </>
  );
}
