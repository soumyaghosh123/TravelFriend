import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('trip');
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-bold">{t('notFound')}</h1>
      <p className="mt-2 text-muted">{t('notFoundBody')}</p>
      <Link href="/" className="mt-5 inline-block rounded-[10px] bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-d">
        {t('newSearch')}
      </Link>
    </main>
  );
}
