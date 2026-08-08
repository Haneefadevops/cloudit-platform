'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { JOBS, Job, TOUR_JOB } from './demo-data';
import StepCompletion from './tour/StepCompletion';
import StepCustomer from './tour/StepCustomer';
import StepDashboard from './tour/StepDashboard';
import StepTechnician from './tour/StepTechnician';

const NARRATION = [
  'A guest at the Grand Pearl Hotel scans the QR code on the AC unit — no app to install. FixifAI’s AI asks the right follow-up question, and job #1042 is created with a tracking number.',
  'The job lands live on the CityFix manager’s board. Click Kasun — the nearest AC technician — to assign it, and watch his pin light up on the map.',
  'Kasun’s phone has everything: navigation, a GPS check-in that proves he’s on site, the service checklist, photos and a voice report. Try the buttons — they all work.',
  'The customer reviews Kasun’s digital service report and taps Approve & Pay. Watch the dashboard: the card glides to Done, the counter ticks up, and the invoice is already on its way.',
];

/**
 * The original 4-step guided tour, shown as an optional overlay
 * on top of the role workspaces (Phase 3B).
 */
export default function GuidedTour({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState(0);
  const [assigned, setAssigned] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [completed, setCompleted] = useState(false);

  // Tour job #1042 progresses with the visitor's actions
  const tourJob: Job = {
    ...TOUR_JOB,
    technicianId: assigned ? 'kasun' : null,
    status: completed ? 'done' : checkedIn ? 'in-progress' : assigned ? 'assigned' : 'new',
  };
  // #1042 only exists on the board after it is "created" in step 1
  const kanbanJobs = step >= 1 ? [...JOBS, tourJob] : JOBS;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-bold text-brand-dark sm:text-base">
          Guided tour — <span className="text-brand-teal">CityFix Maintenance Services</span>
        </p>
        <button
          type="button"
          onClick={onExit}
          aria-label="Close guided tour"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm text-gray-500 transition-colors hover:bg-gray-200"
        >
          ✕
        </button>
      </div>

      {/* tour stage */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {step === 0 && <StepCustomer />}
          {step === 1 && (
            <StepDashboard jobs={kanbanJobs} assigned={assigned} onAssign={() => setAssigned(true)} />
          )}
          {step === 2 && (
            <StepTechnician checkedIn={checkedIn} onCheckIn={() => setCheckedIn(true)} />
          )}
          {step === 3 && (
            <StepCompletion jobs={kanbanJobs} completed={completed} onApprove={() => setCompleted(true)} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* narration + controls */}
      <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-brand-teal/20 bg-[#f0fafa] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-teal font-heading text-xs font-bold text-white">
            {step + 1}
          </span>
          <AnimatePresence mode="wait">
            <motion.p
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-sm leading-relaxed text-gray-700"
            >
              {NARRATION[step]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          <span className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 4`}>
            {NARRATION.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-6 bg-brand-orange' : 'w-1.5 bg-brand-teal/30'
                }`}
              />
            ))}
            <span className="ml-1.5 text-[11px] font-semibold text-gray-500">{step + 1}/4</span>
          </span>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-gray-500 transition-colors hover:text-brand-dark"
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={onExit}
              className="rounded-lg px-3 py-2 text-xs font-semibold text-brand-teal underline-offset-2 transition-colors hover:underline"
            >
              Skip tour
            </button>
            <button
              type="button"
              onClick={() => (step < 3 ? setStep((s) => s + 1) : onExit())}
              className="btn-glow rounded-lg px-5 py-2 text-xs font-semibold text-white"
            >
              {step < 3 ? 'Next →' : 'Finish tour →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
