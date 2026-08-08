'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import Reveal from '@/components/Reveal';
import GuidedTour from '@/components/demo/GuidedTour';
import CustomerPortal from '@/components/demo/workspaces/CustomerPortal';
import ContractorDashboard from '@/components/demo/workspaces/contractor/ContractorDashboard';
import TechnicianApp from '@/components/demo/workspaces/TechnicianApp';

type Persona = 'customer' | 'contractor' | 'technician';

const PERSONAS: { id: Persona; label: string; tagline: string; icon: string }[] = [
  { id: 'customer', label: 'Customer Portal', tagline: 'What your clients see — assets, tracking, approvals', icon: '◉' },
  { id: 'contractor', label: 'Contractor Dashboard', tagline: 'Your back-office — jobs, schedule, money', icon: '▦' },
  { id: 'technician', label: 'Technician App', tagline: 'The field PWA — GPS, checklists, reports', icon: '⚒' },
];

export default function Demo() {
  const [persona, setPersona] = useState<Persona>('contractor');
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <section id="demo" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
            See it in <span className="text-brand-orange">Action</span>
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
            This is the real product, filled with demo data from{' '}
            <strong>CityFix Maintenance Services (Pvt) Ltd</strong>. Pick a role and click
            around everything works, nothing is real.
          </p>
          <p className="mt-4 text-center">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="rounded-lg border border-brand-teal/30 px-5 py-2.5 text-sm font-semibold text-brand-teal transition-colors hover:bg-brand-teal/5"
            >
              ▶ Take the 2-minute guided tour first
            </button>
          </p>
        </Reveal>

        {/* persona tabs */}
        <Reveal delay={0.08} className="mt-10">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="tablist" aria-label="Demo roles">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={persona === p.id}
                onClick={() => setPersona(p.id)}
                className={`flex items-center gap-3 rounded-2xl border-2 p-4 text-left transition-all ${
                  persona === p.id
                    ? 'border-brand-teal bg-[#f0fafa] shadow-md shadow-brand-teal/10'
                    : 'border-gray-200 bg-white hover:border-brand-teal/40'
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold ${
                    persona === p.id ? 'bg-brand-teal text-white' : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {p.icon}
                </span>
                <span>
                  <span className="block font-heading text-sm font-bold text-brand-dark">{p.label}</span>
                  <span className="block text-[11px] leading-snug text-gray-500">{p.tagline}</span>
                </span>
              </button>
            ))}
          </div>
        </Reveal>

        {/* active workspace */}
        <Reveal delay={0.12} className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={persona}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              {persona === 'customer' && <CustomerPortal />}
              {persona === 'contractor' && <ContractorDashboard />}
              {persona === 'technician' && <TechnicianApp />}
            </motion.div>
          </AnimatePresence>
        </Reveal>
      </div>

      {/* guided tour overlay */}
      <AnimatePresence>
        {tourOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-brand-dark/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Guided tour"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="mx-auto my-6 max-w-5xl rounded-2xl bg-white p-4 shadow-2xl sm:p-8"
            >
              <GuidedTour onExit={() => setTourOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
