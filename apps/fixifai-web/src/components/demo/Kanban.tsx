'use client';

import { motion } from 'framer-motion';
import { Job, JobStatus, siteById, technicianById } from './demo-data';

const COLUMNS: { id: JobStatus; label: string; dot: string }[] = [
  { id: 'new', label: 'New', dot: 'bg-brand-orange' },
  { id: 'assigned', label: 'Assigned', dot: 'bg-brand-teal' },
  { id: 'in-progress', label: 'In progress', dot: 'bg-brand-dark' },
  { id: 'done', label: 'Done', dot: 'bg-gray-300' },
];

const PRIORITY_STYLES: Record<Job['priority'], string> = {
  high: 'bg-brand-orange/10 text-brand-orange',
  medium: 'bg-brand-teal/10 text-brand-teal',
  low: 'bg-gray-100 text-gray-500',
};

/**
 * Mini kanban board used by both the guided tour dashboard and
 * explore mode. Cards animate between columns via framer-motion layout.
 * On narrow screens the board scrolls horizontally.
 */
export default function Kanban({
  boardId,
  jobs,
  highlightId,
  onCardClick,
  selectedId,
}: {
  /** Unique per board instance — scopes layout animations so cards only glide within one board. */
  boardId: string;
  jobs: Job[];
  highlightId?: string | null;
  onCardClick?: (job: Job) => void;
  selectedId?: string | null;
}) {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-3">
        {COLUMNS.map((col) => {
          const cards = jobs.filter((j) => j.status === col.id);
          return (
            <div key={col.id} className="w-[172px] shrink-0 rounded-xl bg-white/70 p-2 ring-1 ring-gray-100">
              <div className="mb-2 flex items-center gap-1.5 px-1">
                <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                  {col.label}
                </span>
                <span className="ml-auto rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-500">
                  {cards.length}
                </span>
              </div>
              <div className="space-y-2">
                {cards.map((job) => {
                  const highlighted = job.id === highlightId;
                  const selected = job.id === selectedId;
                  const tech = job.technicianId ? technicianById(job.technicianId) : null;
                  return (
                    <motion.button
                      key={job.id}
                      layout
                      layoutId={`${boardId}-${job.id}`}
                      type="button"
                      onClick={() => onCardClick?.(job)}
                      animate={
                        highlighted
                          ? { boxShadow: ['0 0 0 0 rgba(255,97,0,0.55)', '0 0 0 7px rgba(255,97,0,0)'] }
                          : { boxShadow: '0 0 0 0 rgba(255,97,0,0)' }
                      }
                      transition={
                        highlighted
                          ? { duration: 1.2, repeat: Infinity, ease: 'easeOut' }
                          : { duration: 0.3 }
                      }
                      className={`block w-full rounded-lg border bg-white p-2 text-left shadow-sm transition-colors ${
                        selected
                          ? 'border-brand-teal ring-1 ring-brand-teal'
                          : highlighted
                            ? 'border-brand-orange'
                            : 'border-gray-100 hover:border-brand-teal/40'
                      } ${onCardClick ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px] font-bold text-brand-teal">{job.ref}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${PRIORITY_STYLES[job.priority]}`}
                        >
                          {job.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold leading-snug text-brand-dark">
                        {job.title}
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-gray-500">
                        {siteById(job.siteId).name}
                      </p>
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-teal">
                          {job.trade}
                        </span>
                        {tech ? (
                          <span
                            title={tech.name}
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-brand-orange/90 text-[8px] font-bold text-white"
                          >
                            {tech.initials}
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-gray-400">Unassigned</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
                {cards.length === 0 && (
                  <div className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-[10px] text-gray-400">
                    No jobs
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
