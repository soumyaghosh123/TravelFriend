import type { ReactNode } from 'react';

interface Props {
  label: string;
  htmlFor?: string;
  invalid?: boolean;
  focused?: boolean;
  className?: string;
  children: ReactNode;
}

/** The bordered input box of the search card (mockup `.fld`). */
export function FieldBox({ label, htmlFor, invalid, focused, className = '', children }: Props) {
  const ring = invalid
    ? 'border-bad ring-3 ring-bad-l'
    : focused
      ? 'border-brand ring-3 ring-brand-l'
      : 'border-line focus-within:border-brand focus-within:ring-3 focus-within:ring-brand-l';
  return (
    <div className={`relative min-w-0 rounded-xl border bg-white px-3 py-2 ${ring} ${className}`}>
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold uppercase tracking-[.06em] text-muted"
      >
        {label}
      </label>
      {children}
    </div>
  );
}
