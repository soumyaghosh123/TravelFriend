import type { Metadata } from 'next';
import { SiteHeader } from '../../../components/site-header';
import { VerifyLink } from '../../../components/verify-link';
import { safeNext } from '../../../lib/safe-next';

export const metadata: Metadata = { robots: { index: false } };

/** Where the sign-in email link lands. */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string }>;
}) {
  const sp = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[480px] px-3.5 py-10">
        <VerifyLink token={typeof sp.token === 'string' ? sp.token : ''} next={safeNext(sp.next)} />
      </main>
    </>
  );
}
