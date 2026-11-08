'use client';

import type { ReactNode } from 'react';

interface Props {
  on: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Pill-shaped toggle (mockup `.chip`). */
export function Chip({ on, onToggle, children }: Props) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onToggle}
      className={`rounded-full border px-3 py-1 text-[13px] transition-colors ${
        on ? 'border-brand bg-brand-xl font-semibold text-brand-d' : 'border-line bg-white text-ink2 hover:border-brand/50'
      }`}
    >
      {on && <span aria-hidden>✓ </span>}
      {children}
    </button>
  );
}
