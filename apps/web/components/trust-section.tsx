import { getTranslations } from 'next-intl/server';

const ITEMS = ['source', 'dates', 'styles', 'partner'] as const;

/** "Plan smart. Travel more." over a full-width mountain photo (mockup `.scenic`). */
export async function TrustSection() {
  const t = await getTranslations('trust');
  return (
    <section
      id="how"
      className="relative mt-10 bg-cover bg-center px-3.5 py-[60px] text-white md:bg-fixed md:px-6"
      style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1800&q=70')" }}
    >
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[rgba(15,23,42,.55)] to-[rgba(15,23,42,.75)]" />
      <div className="relative">
        <h2 className="mb-1.5 text-center text-2xl font-bold">{t('title')}</h2>
        <p className="mb-[22px] text-center text-[#cbd5e1]">{t('sub')}</p>
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((k) => (
            <div key={k} className="rounded-card border border-white/20 bg-white/12 p-3.5 backdrop-blur-md">
              <b className="mb-0.5 block">{t(`${k}.title`)}</b>
              <span className="text-[13px] text-[#e2e8f0]">{t(`${k}.body`)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
