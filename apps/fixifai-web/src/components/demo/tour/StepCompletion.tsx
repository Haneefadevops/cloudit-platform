'use client';

import { animate, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import BrowserFrame from '../BrowserFrame';
import Kanban from '../Kanban';
import PhoneFrame from '../PhoneFrame';
import { Job, TOUR_JOB, TOUR_TRACKING_NO } from '../demo-data';

/** Animated counter — ticks from 127 to 128 when the job completes. */
function JobsCompletedCounter({ completed }: { completed: boolean }) {
  const [value, setValue] = useState(127);

  useEffect(() => {
    if (!completed) return;
    const controls = animate(127, 128, {
      duration: 1,
      delay: 0.4,
      ease: 'easeOut',
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [completed]);

  return (
    <motion.span
      key={value}
      initial={{ scale: 1.25, color: '#FF6100' }}
      animate={{ scale: 1, color: '#008080' }}
      transition={{ duration: 0.5 }}
      className="font-heading text-base font-bold"
    >
      {value}
    </motion.span>
  );
}

/**
 * Tour step 4 — completion: the customer approves the service report
 * and pays; the kanban card glides to Done and the counter ticks up.
 */
export default function StepCompletion({
  jobs,
  completed,
  onApprove,
}: {
  jobs: Job[];
  completed: boolean;
  onApprove: () => void;
}) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[310px_1fr]">
      {/* customer approval view */}
      <PhoneFrame title="FixifAI — Customer" caption="Customer's phone — approve & pay">
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-teal">{TOUR_JOB.ref}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                  completed ? 'bg-brand-teal/10 text-brand-teal' : 'bg-brand-orange/10 text-brand-orange'
                }`}
              >
                {completed ? 'APPROVED & PAID' : 'AWAITING APPROVAL'}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-brand-dark">Service report — {TOUR_JOB.title}</p>
            <p className="text-[10px] text-gray-500">Grand Pearl Hotel · by Kasun Perera</p>

            <ul className="mt-2 space-y-1 text-[10px] text-gray-600">
              <li className="flex gap-1.5">
                <span className="text-brand-teal">✓</span> Refrigerant leak traced & sealed
              </li>
              <li className="flex gap-1.5">
                <span className="text-brand-teal">✓</span> Gas recharged, filters cleaned
              </li>
              <li className="flex gap-1.5">
                <span className="text-brand-teal">✓</span> 15-min test run — cooling restored
              </li>
            </ul>

            <div className="mt-2 flex gap-2">
              <div className="flex h-12 flex-1 items-center justify-center rounded-lg bg-gradient-to-br from-brand-teal/15 to-brand-dark/15 text-[9px] font-semibold text-brand-teal">
                before
              </div>
              <div className="flex h-12 flex-1 items-center justify-center rounded-lg bg-gradient-to-br from-brand-teal/25 to-brand-dark/25 text-[9px] font-semibold text-brand-teal">
                after
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
              <span className="text-[10px] text-gray-500">Invoice total</span>
              <span className="font-heading text-sm font-bold text-brand-dark">LKR 18,500</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onApprove}
            disabled={completed}
            className={`w-full rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors ${
              completed
                ? 'cursor-default bg-brand-teal/10 text-brand-teal'
                : 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 hover:bg-brand-orange/90'
            }`}
          >
            {completed ? 'Payment approved ✓' : 'Approve & Pay'}
          </button>

          {completed && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg bg-gray-50 px-2 py-1.5 text-center text-[9px] text-gray-500"
            >
              Receipt sent · tracking {TOUR_TRACKING_NO} closed
            </motion.p>
          )}
        </div>
      </PhoneFrame>

      {/* dashboard reaction */}
      <BrowserFrame caption="Manager dashboard — the card closes itself">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-lg border border-gray-100 bg-white p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Open jobs</p>
              <p className="mt-0.5 font-heading text-base font-bold text-brand-teal">
                {completed ? 4 : 5}
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                Jobs completed · Jul
              </p>
              <p className="mt-0.5">
                <JobsCompletedCounter completed={completed} />
              </p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Invoice</p>
              <p className="mt-0.5 font-heading text-base font-bold text-brand-dark">
                {completed ? 'Sent ✓' : 'Draft'}
              </p>
            </div>
          </div>

          {completed && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg bg-brand-teal/10 px-3 py-2 text-[11px] font-semibold text-brand-teal"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-teal text-[10px] text-white">
                ✓
              </span>
              #1042 approved & paid — invoice sent automatically
            </motion.div>
          )}

          <Kanban boardId="tour-final" jobs={jobs} />
          <p className="text-[10px] text-gray-400">
            {completed
              ? 'Card moved to Done — no one touched the board.'
              : 'Watch the #1042 card when the customer taps Approve & Pay.'}
          </p>
        </div>
      </BrowserFrame>
    </div>
  );
}
