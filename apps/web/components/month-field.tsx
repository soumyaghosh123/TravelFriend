'use client';

import { MONTHS_AHEAD, monthFrom } from '@tripsaver/domain';
import { useLocale, useTranslations } from 'next-intl';
import { useId } from 'react';
import { monthLabel } from '../lib/format';
import { FieldBox } from './field-box';
import { FieldError } from './field-error';

interface Props {
  today: string;
  value: string;
  onChange: (month: string) => void;
  error?: string;
}

/** Month of travel. The user never picks exact dates; we find the cheapest ones (brief §2.1). */
export function MonthField({ today, value, onChange, error }: Props) {
  const t = useTranslations('search');
  const locale = useLocale();
  const id = useId();
  const months = Array.from({ length: MONTHS_AHEAD }, (_, i) => monthFrom(today, i));
  return (
    <div className="min-w-0">
      <FieldBox label={t('month')} htmlFor={id} invalid={!!error}>
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          className="mt-0.5 w-full cursor-pointer appearance-none bg-transparent text-[15px] font-semibold outline-none"
        >
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, locale)}
            </option>
          ))}
        </select>
        <div className="truncate text-xs text-muted">{t('monthHint')}</div>
      </FieldBox>
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}
