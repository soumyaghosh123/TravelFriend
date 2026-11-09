import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DestinationBanner } from '../../../components/destination-banner';
import { GuidePanel, type GuideTab } from '../../../components/guide-panel';
import { SiteFooter } from '../../../components/site-footer';
import { SiteHeader } from '../../../components/site-header';
import { getGuide } from '../../../lib/api';

const SECTIONS: GuideTab[] = ['sights', 'food', 'shopping', 'dos'];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await getGuide(slug).catch(() => null);
  if (!guide) return {};
  const t = await getTranslations('guidePage');
  return {
    title: t('metaTitle', { name: guide.destination.name }),
    description: t('metaDescription', { name: guide.destination.name }),
  };
}

/**
 * Destination guide (PLAN §9 `/destination/[slug]`): sights, food, shopping, do's & don'ts, for SEO and
 * planning. Server-rendered on request; the guide fetch is cached for an hour (see `getGuide`).
 */
export default async function DestinationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);
  if (!guide) notFound();
  const t = await getTranslations('guidePage');
  const tabs = await getTranslations('results.tabs');
  const { code, name, kind } = guide.destination;

  return (
    <>
      <SiteHeader />
      <DestinationBanner code={code} name={name} kind={kind} title={t('title', { name })} />
      <main className="mx-auto max-w-[1184px] space-y-6 px-3.5 py-5 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-2xl text-ink2">{t('intro', { name, area: guide.mainArea.name })}</p>
          <Link
            href={`/?to=${code}#search`}
            className="rounded-xl bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-d"
          >
            {t('plan', { name })}
          </Link>
        </div>
        {SECTIONS.map((s) => (
          <section key={s} aria-labelledby={`guide-${s}`} className="space-y-2.5">
            <h2 id={`guide-${s}`} className="text-xl font-bold tracking-[-.3px]">
              {tabs(s)}
            </h2>
            <GuidePanel tab={s} guide={guide} style="budget" />
          </section>
        ))}
      </main>
      <SiteFooter />
    </>
  );
}
