import React from 'react';
import { cx } from './Card';

export type BadgeTone =
  | 'gray'
  | 'amber'
  | 'teal'
  | 'green'
  | 'navy'
  | 'indigo'
  | 'blue'
  | 'red';

const tones: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-100 text-amber-800',
  teal: 'bg-teal-50 text-teal-700',
  green: 'bg-green-100 text-green-700',
  navy: 'bg-[#e6e8f5] text-brand-navy',
  indigo: 'bg-indigo-100 text-indigo-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
};

/**
 * Brand-consistent status chips. Maps every existing domain status to a tone:
 * bookings: pending=amber, confirmed=teal, completed=green, cancelled=gray, no_show=red
 * orders: draft=gray, pending=amber, confirmed=teal, preparing=indigo,
 *         out_for_delivery=blue, completed=green, cancelled=red
 */
export function statusTone(status?: string | null): BadgeTone {
  switch ((status || '').toLowerCase()) {
    case 'pending':
      return 'amber';
    case 'confirmed':
    case 'active':
      return 'teal';
    case 'preparing':
      return 'indigo';
    case 'out_for_delivery':
      return 'blue';
    case 'completed':
    case 'approved':
    case 'paid':
      return 'green';
    case 'no_show':
    case 'rejected':
    case 'failed':
      return 'red';
    case 'draft':
    case 'cancelled':
    case 'canceled':
    case 'inactive':
    default:
      return 'gray';
  }
}

export function Badge({
  tone = 'gray',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <Badge tone={statusTone(status)}>{(status || '—').replace(/_/g, ' ')}</Badge>;
}
