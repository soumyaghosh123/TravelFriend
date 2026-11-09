/** Placeholder while a streamed section is on its way. */
export function SkeletonBlock({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`animate-pulse rounded-card bg-white p-4 shadow-card ${className}`}
    >
      <span className="text-sm text-muted">{label}</span>
      <div className="mt-3 h-3 w-2/3 rounded bg-line" />
      <div className="mt-2 h-3 w-1/2 rounded bg-line" />
    </div>
  );
}
