import React from 'react';
import { cx } from './Card';

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table
        className={cx('w-full border-collapse text-left text-sm', className)}
      >
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
      {children}
    </thead>
  );
}

export function TR({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cx(
        'border-b border-line last:border-0',
        onClick && 'cursor-pointer hover:bg-page',
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TH({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <th className={cx('px-3 py-2.5 font-medium', className)}>{children}</th>;
}

export function TD({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cx('px-3 py-3 align-top', className)}>
      {children}
    </td>
  );
}
