import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  return (
    <footer className="bg-[#0b1220] px-3.5 py-[22px] text-xs text-[#94a3b8] md:px-6">
      {t.rich('text', { b: (c) => <b className="text-[#e2e8f0]">{c}</b> })} · {t('affiliate')} · {t('privacy')} · {t('terms')}
    </footer>
  );
}
