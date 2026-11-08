'use client';

import { useTranslations } from 'next-intl';

/** Shows a translated validation message (`message` is an i18n key such as `days.range`). */
export function FieldError({ id, message }: { id: string; message?: string }) {
  const t = useTranslations('search.errors');
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs font-medium text-bad">
      {t.has(message) ? t(message) : t('unknown')}
    </p>
  );
}
