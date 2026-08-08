'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import AssetTimeline from '../../../AssetTimeline';
import Kanban from '../../../Kanban';
import {
  JOBS,
  Job,
  TRADE_CHECKLISTS,
  assetById,
  customerBySite,
  siteById,
  technicianById,
} from '../../../demo-data';

const TIMELINE_STAGES = ['Reported', 'Assigned', 'On site', 'Completed'] as const;

function stageIndex(status: Job['status']): number {
  return status === 'new' ? 0 : status === 'assigned' ? 1 : status === 'in-progress' ? 2 : 3;
}

const STAGE_TIMES = ['Mon 9:02 AM', 'Mon 9:15 AM', 'Mon 10:40 AM', 'Mon 12:05 PM'];

/** Full job detail panel — customer, asset, checklist, photos, status timeline. */
function JobDetail({ job, onClose }: { job: Job; onClose: () => void }) {
  const asset = assetById(job.assetId);
  const site = siteById(job.siteId);
  const customer = customerBySite(job.siteId);
  const tech = job.technicianId ? technicianById(job.technicianId) : null;
  const reached = stageIndex(job.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.25 }}
      className="relative mt-3 rounded-xl border border-brand-teal/25 bg-white p-4 shadow-md"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close job detail"
        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 hover:bg-gray-200"
      >
        ✕
      </button>

      <div className="flex flex-wrap items-center gap-2 pr-8">
        <span className="font-mono text-xs font-bold text-brand-teal">{job.ref}</span>
        <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-semibold text-brand-teal">
          {job.trade}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold capitalize text-gray-500">
          {job.status.replace('-', ' ')}
        </span>
      </div>
      <p className="mt-1.5 font-heading text-sm font-bold text-brand-dark">{job.title}</p>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        {/* left: customer / asset / timeline */}
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg bg-gray-50 p-3 text-xs">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Customer</dt>
              <dd className="font-medium text-brand-dark">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Contact</dt>
              <dd className="font-medium text-brand-dark">{customer.phone}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Site</dt>
              <dd className="font-medium text-brand-dark">
                {site.name} · {site.city}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Technician</dt>
              <dd className="font-medium text-brand-dark">{tech ? tech.name : 'Unassigned'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-[10px] uppercase tracking-wide text-gray-400">Asset</dt>
              <dd className="font-medium text-brand-dark">
                {asset.name} <span className="font-mono text-[10px] text-gray-400">({asset.qrCode})</span>
              </dd>
            </div>
          </dl>

          {/* status timeline */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Status timeline
            </p>
            <ol className="relative space-y-2.5 border-l-2 border-brand-teal/20 pl-4">
              {TIMELINE_STAGES.map((label, i) => (
                <li key={label} className="relative">
                  <span
                    className={`absolute -left-[21px] top-0.5 h-2 w-2 rounded-full ring-2 ring-white ${
                      i <= reached ? 'bg-brand-teal' : 'bg-gray-300'
                    }`}
                  />
                  <p className={`text-[11px] font-semibold ${i <= reached ? 'text-brand-dark' : 'text-gray-400'}`}>
                    {label}
                  </p>
                  {i <= reached && <p className="text-[10px] text-gray-400">{STAGE_TIMES[i]}</p>}
                </li>
              ))}
            </ol>
          </div>

          {/* asset history */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Asset history — {asset.name}
            </p>
            <AssetTimeline history={asset.history} compact />
          </div>
        </div>

        {/* right: checklist + photos */}
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-100 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {job.trade} checklist
            </p>
            <ul className="space-y-1.5">
              {TRADE_CHECKLISTS[job.trade].map((item, i) => {
                const done = job.status === 'done' || (job.status === 'in-progress' && i < 2);
                return (
                  <li key={item} className="flex items-center gap-2 text-[11px] text-brand-dark">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border text-[9px] font-bold ${
                        done ? 'border-brand-teal bg-brand-teal text-white' : 'border-gray-300 text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <span className={done ? 'text-gray-400 line-through' : ''}>{item}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-100 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Photos</p>
            <div className="grid grid-cols-2 gap-2">
              {['before', 'after'].map((kind) => (
                <div
                  key={kind}
                  className={`flex h-16 items-center justify-center rounded-lg text-[10px] font-semibold ${
                    job.status === 'done' || (kind === 'before' && job.status === 'in-progress')
                      ? 'bg-gradient-to-br from-brand-teal/20 to-brand-dark/20 text-brand-teal'
                      : 'border border-dashed border-gray-200 text-gray-300'
                  }`}
                >
                  {kind}
                </div>
              ))}
            </div>
          </div>

          {job.status === 'done' && (
            <p className="rounded-lg bg-brand-teal/10 px-3 py-2 text-[11px] font-semibold text-brand-teal">
              Invoice generated automatically on completion ✓
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Jobs screen — kanban where every card opens a full job detail. */
export default function JobsScreen() {
  const [selected, setSelected] = useState<Job | null>(null);

  return (
    <div>
      <Kanban
        boardId="dash-jobs"
        jobs={JOBS}
        onCardClick={(job) => setSelected((cur) => (cur?.id === job.id ? null : job))}
        selectedId={selected?.id ?? null}
      />
      <AnimatePresence>
        {selected && <JobDetail job={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
