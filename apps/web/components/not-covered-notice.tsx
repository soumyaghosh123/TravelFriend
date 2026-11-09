import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DESTINATIONS } from '../lib/destinations';

/**
 * A saved or shared search whose "To" is a place we only know as a starting point (e.g. Delhi):
 * say so plainly instead of showing "temporarily unavailable" everywhere.
 */
export async function NotCoveredNotice({ toName, changeHref }: { toName: string; changeHref: string }) {
  const t = await getTranslations('trip.notCovered');
  return (
    <main className="mx-auto max-w-[720px] px-3.5 py-10">
      <div className="rounded-card bg-white p-6 shadow-card">
        <h1 className="text-xl font-bold">{t('title', { name: toName })}</h1>
        <p className="mt-2 text-ink2">{t('body', { name: toName })}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {DESTINATIONS.map((d) => (
            <li key={d.code}>
              <Link
                href={`/?to=${d.code}#search`}
                className="rounded-full border border-line px-3 py-1.5 font-semibold text-brand hover:border-brand"
              >
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href={changeHref}
          className="mt-5 inline-block rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-d"
        >
          {t('change')}
        </Link>
      </div>
    </main>
  );
}
