'use client';

import { motion } from 'framer-motion';
import BrowserFrame from '../BrowserFrame';
import Kanban from '../Kanban';
import MiniMap from '../MiniMap';
import { Job, TECHNICIANS } from '../demo-data';

/**
 * Tour step 2 — the manager dashboard: job #1042 lands in the New
 * column (pulsing), the visitor assigns Kasun with one click,
 * and the mini map focuses his pin.
 */
export default function StepDashboard({
  jobs,
  assigned,
  onAssign,
}: {
  jobs: Job[];
  assigned: boolean;
  onAssign: () => void;
}) {
  return (
    <BrowserFrame caption="Manager dashboard — CityFix Maintenance Services">
      <div className="space-y-3">
        {/* stat chips */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-gray-100 bg-white p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Open jobs</p>
            <p className="mt-0.5 font-heading text-base font-bold text-brand-teal">5</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Techs on site</p>
            <p className="mt-0.5 font-heading text-base font-bold text-brand-orange">4</p>
          </div>
          <div className="rounded-lg border border-gray-100 bg-white p-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Done today</p>
            <p className="mt-0.5 font-heading text-base font-bold text-brand-dark">7</p>
          </div>
        </div>

        {/* live arrival banner */}
        {!assigned && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 rounded-lg bg-brand-orange/10 px-3 py-2 text-[11px] font-semibold text-brand-orange"
          >
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="h-2 w-2 rounded-full bg-brand-orange"
            />
            New job just arrived — #1042 · Suite 1204 AC not cooling
          </motion.div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
          <div className="min-w-0">
            <Kanban boardId="tour-dash" jobs={jobs} highlightId={assigned ? null : 'j1042'} />

            {/* assign panel */}
            <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3">
              {assigned ? (
                <motion.p
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 text-[11px] font-semibold text-brand-teal"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-teal text-[10px] text-white">
                    ✓
                  </span>
                  Assigned to Kasun Perera — he&apos;s been notified on his phone.
                </motion.p>
              ) : (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Assign #1042 — nearest AC techs
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {TECHNICIANS.filter((t) => t.trade.includes('AC')).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={t.id === 'kasun' ? onAssign : undefined}
                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11px] font-semibold transition-colors ${
                          t.id === 'kasun'
                            ? 'border-brand-orange bg-brand-orange/5 text-brand-dark hover:bg-brand-orange/10'
                            : 'cursor-not-allowed border-gray-100 text-gray-400'
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                            t.id === 'kasun' ? 'bg-brand-orange' : 'bg-gray-300'
                          }`}
                        >
                          {t.initials}
                        </span>
                        <span>
                          {t.name.split(' ')[0]}
                          {t.id === 'kasun' && (
                            <span className="ml-1 rounded-full bg-brand-orange px-1.5 py-0.5 text-[8px] font-bold text-white">
                              1.2 km
                            </span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">
                    Click Kasun to assign — drag &amp; drop works in the real app.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* technician map */}
          <div className="min-w-0">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Technicians live
            </p>
            <MiniMap focusId={assigned ? 'kasun' : null} />
            <ul className="mt-2 space-y-1">
              {TECHNICIANS.slice(0, 4).map((t) => (
                <li key={t.id} className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      t.status === 'available'
                        ? 'bg-brand-teal'
                        : t.status === 'on-job'
                          ? 'bg-brand-orange'
                          : 'bg-gray-300'
                    }`}
                  />
                  {t.name.split(' ')[0]} — {t.status === 'on-job' ? 'on a job' : t.status}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
