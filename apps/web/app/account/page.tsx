import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AccountView } from '../../components/account-view';
import { SiteFooter } from '../../components/site-footer';
import { SiteHeader } from '../../components/site-header';
import { safeNext } from '../../lib/safe-next';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('account');
  return { title: `${t('myTrips')} · TripSaver`, robots: { index: false } };
}

/** `/account` (PLAN §9): sign in, saved trips, price alerts. `?next=` brings you back after signing in; `?open=<trip>` (from an alert email) opens a saved trip. */
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signin?: string; open?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[640px] px-3.5 py-8">
        <AccountView
          next={safeNext(sp.next)}
          failed={sp.signin === 'failed'}
          {...(typeof sp.open === 'string' ? { open: sp.open } : {})}
        />
      </main>
      <SiteFooter />
    </>
  );
}
