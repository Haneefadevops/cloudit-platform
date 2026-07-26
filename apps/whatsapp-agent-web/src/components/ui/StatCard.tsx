import React from 'react';
import { cx } from './Card';

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'rounded-card border border-line bg-white p-5 shadow-card',
        className,
      )}
    >
      <p className="m-0 text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mb-0 mt-1.5 text-2xl font-semibold text-brand-navy">
        {value}
      </p>
      {hint && <p className="mb-0 mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function UsageBar({
  used,
  limit,
  label,
  className,
}: {
  used: number;
  limit: number;
  label?: string;
  className?: string;
}) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label ?? 'Usage'}</span>
        <span className="text-muted">
          {used.toLocaleString()} / {limit.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
