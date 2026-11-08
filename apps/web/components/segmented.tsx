'use client';

interface Props<T extends string> {
  label: string;
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
}

/** Button group for switching views (mockup `.mtabs`). */
export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={o.id === value}
          disabled={o.disabled}
          onClick={() => onChange(o.id)}
          className={`rounded-[10px] border px-3 py-1.5 font-semibold ${
            o.id === value ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink2 hover:border-ink/40'
          } disabled:opacity-40`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
