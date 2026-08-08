'use client';

import Kanban from '../../../Kanban';
import MiniMap from '../../../MiniMap';
import { JOBS, TECHNICIANS } from '../../../demo-data';

const STATS = [
  { label: 'Open jobs', value: '5', accent: 'text-brand-teal' },
  { label: 'Techs on site', value: String(TECHNICIANS.filter((t) => t.status === 'on-job').length), accent: 'text-brand-orange' },
  { label: 'Revenue · Jul', value: 'LKR 2.9M', accent: 'text-brand-dark' },
  { label: 'Avg response', value: '38 min', accent: 'text-brand-teal' },
];

/** Dashboard home — stat cards, live kanban and the technician map. */
export default function DashboardHome() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg border border-gray-100 bg-white p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">{s.label}</p>
            <p className={`mt-0.5 font-heading text-lg font-bold ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white/70 p-3 ring-1 ring-gray-100">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Live job board
        </p>
        <Kanban boardId="dash-home" jobs={JOBS} />
      </div>

      <div className="rounded-xl bg-white/70 p-3 ring-1 ring-gray-100">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Technicians — live map
        </p>
        <MiniMap focusId="kasun" />
      </div>
    </div>
  );
}
