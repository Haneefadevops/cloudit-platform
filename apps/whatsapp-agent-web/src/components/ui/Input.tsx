import React from 'react';
import { cx } from './Card';

const fieldClass =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-navy outline-none transition-colors placeholder:text-muted focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20';

export function Input({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  const input = <input className={cx(fieldClass, className)} {...props} />;
  if (!label) return input;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {input}
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const select = (
    <select className={cx(fieldClass, className)} {...props}>
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {select}
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const area = <textarea className={cx(fieldClass, className)} {...props} />;
  if (!label) return area;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {area}
    </label>
  );
}
