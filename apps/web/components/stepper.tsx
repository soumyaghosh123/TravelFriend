'use client';

import { useTranslations } from 'next-intl';

interface Props {
  value: number;
  min: number;
  max: number;
  /** What is being counted, for screen readers ("days", "adults"). */
  label: string;
  onChange: (value: number) => void;
}

const btn =
  'grid size-7 place-items-center rounded-full border border-line font-bold text-brand hover:bg-brand-xl disabled:opacity-35 disabled:hover:bg-transparent';

export function Stepper({ value, min, max, label, onChange }: Props) {
  const t = useTranslations('search');
  return (
    <div className="mt-0.5 flex items-center gap-2.5" role="group" aria-label={label}>
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label={t('decrease', { what: label })}
      >
        −
      </button>
      <b className="min-w-5 text-center text-[15px] tabular-nums" aria-live="polite">
        {value}
      </b>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={t('increase', { what: label })}
      >
        +
      </button>
    </div>
  );
}
