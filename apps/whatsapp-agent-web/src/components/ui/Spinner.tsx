import React from 'react';
import { cx } from './Card';

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cx('animate-spin text-brand-indigo', className)}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="3"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-12 text-sm text-muted">
      <Spinner />
      {label}
    </div>
  );
}
