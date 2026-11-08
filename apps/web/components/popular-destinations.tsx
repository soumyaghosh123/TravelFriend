import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { DESTINATIONS, photoUrl } from '../lib/destinations';

// No prices here on purpose: every price must come through <Price> with a source and fetchedAt (golden rule 1).

export async function PopularDestinations({ query }: { query: string }) {
  const t = await getTranslations('destinations');
  const keep = new URLSearchParams(query);
  return (
    <section id="destinations" className="mx-auto my-[34px] max-w-[1180px] scroll-mt-4 px-3.5 xl:px-1">
      <h2 className="mb-1 text-xl font-bold tracking-[-.3px]">{t('title')}</h2>
      <p className="mb-3.5 text-muted">{t('sub')}</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {DESTINATIONS.map((d) => {
          const q = new URLSearchParams(keep);
          q.set('to', d.code);
          return (
            <Link
              key={d.code}
              href={`/?${q.toString()}#search`}
              scroll={false}
              className="group overflow-hidden rounded-card bg-white shadow-card transition-shadow hover:shadow-lg"
            >
              <div
                className="flex h-[140px] items-end p-2.5 text-[17px] font-bold text-white [text-shadow:0_1px_4px_rgba(0,0,0,.4)]"
                style={{
                  background: `linear-gradient(0deg,rgba(0,0,0,.45),transparent 55%),url('${photoUrl(d.photo, 500)}') center/cover,${d.color}`,
                }}
              >
                {d.name}
              </div>
              <div className="px-3 py-2.5">
                <small className="block text-muted">{t(`kind.${d.kind}`)}</small>
                <b className="text-brand group-hover:text-brand-d">{t('plan')}</b>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
