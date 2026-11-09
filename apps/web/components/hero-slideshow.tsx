'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

// Placeholder photos from Unsplash, as in the approved mockup. Production uses licensed images on our CDN (PLAN §9.1).
const SLIDES = [
  {
    key: 'beach',
    icon: '🏖️',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1800&q=70',
  },
  { key: 'trail', icon: '🏔️', url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1800&q=70' },
  {
    key: 'coast',
    icon: '🌴',
    url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1800&q=70',
  },
  {
    key: 'snow',
    icon: '❄️',
    url: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1800&q=70',
  },
] as const;

/** Crossfading beach / mountain banner with a slow zoom and a dark tint (mockup `.hero`). */
export function HeroSlideshow() {
  const t = useTranslations('hero');
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative min-h-[300px] overflow-hidden bg-[#134e4a] px-4 pb-20 pt-7 text-white md:min-h-[380px] md:px-6 md:pb-[110px] md:pt-[70px]">
      {SLIDES.map((s, n) => (
        <div
          key={s.key}
          aria-hidden
          className={`motion-safe-kb absolute inset-0 animate-kenburns bg-cover bg-center transition-opacity duration-[1600ms] ${n === i ? 'opacity-100' : 'opacity-0'}`}
          style={{ backgroundImage: `url('${s.url}')` }}
        />
      ))}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg,rgba(4,47,46,.82) 0%,rgba(4,47,46,.55) 45%,rgba(4,47,46,.1) 100%),linear-gradient(0deg,rgba(0,0,0,.35),transparent 40%)',
        }}
      />
      <div className="relative z-[2] mx-auto max-w-[1180px]">
        <h1 className="mb-3 max-w-[720px] text-[28px] font-bold leading-[1.08] tracking-[-1px] [text-shadow:0_2px_12px_rgba(0,0,0,.3)] md:text-[44px]">
          {t('title')}
        </h1>
        <p className="max-w-[600px] text-[15px] text-[#e6fffb] [text-shadow:0_1px_6px_rgba(0,0,0,.35)] md:text-base">
          {t('body')}
        </p>
        <div className="mt-[18px] flex gap-1.5" aria-hidden>
          {SLIDES.map((s, n) => (
            <i key={s.key} className={`h-1 w-[22px] rounded-full ${n === i ? 'bg-accent' : 'bg-white/40'}`} />
          ))}
        </div>
      </div>
      <div
        className="absolute bottom-[84px] right-6 z-[2] hidden rounded-full bg-black/35 px-2.5 py-1 text-xs backdrop-blur-sm md:block"
        aria-hidden
      >
        {SLIDES[i]!.icon} {t(`captions.${SLIDES[i]!.key}`)}
      </div>
    </section>
  );
}
