'use client';

import { TECHNICIANS, Technician } from '../../../demo-data';

const STATUS_STYLES: Record<Technician['status'], { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-brand-teal/10 text-brand-teal' },
  'on-job': { label: 'On a job', cls: 'bg-brand-orange/10 text-brand-orange' },
  'off-duty': { label: 'Off duty', cls: 'bg-gray-100 text-gray-500' },
};

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="text-[11px] tracking-tight text-brand-orange" title={`${rating} / 5`}>
      {'★'.repeat(full)}
      <span className="text-gray-300">{'★'.repeat(5 - full)}</span>
      <span className="ml-1 text-[10px] font-semibold text-gray-500">{rating.toFixed(1)}</span>
    </span>
  );
}

/** Technicians screen — cards with live status, today's workload and rating. */
export default function TechniciansScreen() {
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {TECHNICIANS.map((tech) => (
        <div
          key={tech.id}
          className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-orange/90 text-xs font-bold text-white">
              {tech.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-brand-dark">{tech.name}</p>
              <p className="truncate text-[10px] text-gray-500">{tech.trade}</p>
            </div>
            <span
              className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_STYLES[tech.status].cls}`}
            >
              {STATUS_STYLES[tech.status].label}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2.5 text-center">
            <div>
              <p className="font-heading text-sm font-bold text-brand-dark">{tech.jobsToday}</p>
              <p className="text-[9px] uppercase tracking-wide text-gray-400">Jobs today</p>
            </div>
            <div>
              <p className="font-heading text-sm font-bold text-brand-dark">{tech.jobsDone}</p>
              <p className="text-[9px] uppercase tracking-wide text-gray-400">All time</p>
            </div>
            <div>
              <Stars rating={tech.rating} />
              <p className="text-[9px] uppercase tracking-wide text-gray-400">Rating</p>
            </div>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] text-gray-400">{tech.phone}</p>
        </div>
      ))}
    </div>
  );
}
