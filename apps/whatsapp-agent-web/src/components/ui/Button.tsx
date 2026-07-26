import React from 'react';
import { cx } from './Card';

type Variant = 'primary' | 'outline' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-gradient text-white shadow-card hover:opacity-90 border border-transparent',
  outline:
    'border border-line bg-white text-brand-navy hover:bg-page',
  danger:
    'border border-transparent bg-red-600 text-white hover:bg-red-700',
  ghost:
    'border border-transparent text-muted hover:bg-page hover:text-brand-navy',
};

const sizes: Record<Size, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cx(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
