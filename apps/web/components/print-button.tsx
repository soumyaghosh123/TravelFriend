'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

/** "Save as PDF / Print" on the printable plan. With `auto`, opens the print dialog once the page has loaded. */
export function PrintButton({ auto, backHref }: { auto?: boolean; backHref: string }) {
  const t = useTranslations('results.export');
  useEffect(() => {
    if (!auto) return;
    const id = setTimeout(() => window.print(), 400);
    return () => clearTimeout(id);
  }, [auto]);
  return (
    <div className="mx-auto flex max-w-[860px] flex-wrap items-center gap-3 px-4 pt-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-xl bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-d"
      >
        {t('savePdf')}
      </button>
      <a href={backHref} className="text-sm font-semibold text-brand hover:underline">
        ← {t('back')}
      </a>
      <p className="w-full text-xs text-muted">{t('pdfHint')}</p>
    </div>
  );
}
