'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Reveal from './Reveal';

const verticals = [
  {
    icon: '🩺',
    name: 'Clinics',
    customer: 'Can I get Friday 7:30 with Dr. Perera?',
    ai: 'Booked ✅ Friday 7:30pm with Dr. Perera. Reminder sent!',
  },
  {
    icon: '💇',
    name: 'Salons & Spas',
    customer: 'Any slot tomorrow for a haircut?',
    ai: '3:00pm with Naduni is free — shall I book it for you?',
  },
  {
    icon: '🛍',
    name: 'Online Shops',
    customer: 'Price of the 2kg ribbon cake?',
    ai: 'LKR 6,500 🎂 Want me to reserve one for Saturday?',
  },
  {
    icon: '🍛',
    name: 'Restaurants',
    customer: 'Table for 4 tonight at 8pm?',
    ai: 'Booked ✅ Table for 4, 8:00pm tonight. See you!',
  },
  {
    icon: '🎓',
    name: 'Education',
    customer: 'When does the next batch start?',
    ai: 'July 1st! 12 seats left — want the fee details?',
  },
  {
    icon: '🏠',
    name: 'Real Estate',
    customer: 'Houses under 30M in Nugegoda?',
    ai: '3 matches found 🏠 Shall I schedule a viewing this weekend?',
  },
];

export default function Verticals() {
  const [active, setActive] = useState(0);

  // Auto-rotate; keying the interval on `active` restarts the timer after a click.
  useEffect(() => {
    const iv = setInterval(() => {
      setActive((a) => (a + 1) % verticals.length);
    }, 4500);
    return () => clearInterval(iv);
  }, [active]);

  const current = verticals[active];

  return (
    <section id="possibilities" className="border-t border-[#e6e8f5] py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#12142b] sm:text-4xl">
            <span className="text-gradient">One AI.</span> Endless Possibilities.
          </h2>
          <p className="mt-4 text-lg text-[#5a5e7a]">
            Turn every WhatsApp conversation into an opportunity with TheReplyte.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
          {/* Tab list */}
          <Reveal>
            <div className="flex flex-col gap-2">
              {verticals.map((v, i) => {
                const isActive = i === active;
                return (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setActive(i)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200 ${
                      isActive
                        ? 'border-transparent bg-gradient-to-r from-teal-brand to-indigo-brand font-semibold text-white shadow-[0_10px_28px_-8px_rgba(74,66,252,0.45)]'
                        : 'border-[#dfe3f7] bg-white text-[#5a5e7a] hover:border-indigo-brand hover:text-[#12142b] hover:shadow-[0_0_0_2px_rgba(74,66,252,0.35),0_10px_28px_rgba(74,66,252,0.15)]'
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {v.icon}
                    </span>
                    <span className="text-sm">{v.name}</span>
                  </button>
                );
              })}
            </div>
          </Reveal>

          {/* Mini chat panel */}
          <Reveal delay={0.1}>
            <div className="glass rounded-2xl border border-[#e6e8f5] p-3 shadow-[0_18px_48px_-20px_rgba(18,20,43,0.22)]">
              <div
                className="flex min-h-[220px] flex-col justify-center gap-2.5 rounded-xl bg-[#efeae2] px-4 py-6"
                style={{
                  backgroundImage:
                    'radial-gradient(rgba(18,20,43,0.055) 1px, transparent 1px)',
                  backgroundSize: '22px 22px',
                }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={active}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="flex flex-col gap-2.5"
                  >
                    <div className="w-fit max-w-[82%] self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#111b21] shadow-sm">
                      {current.customer}
                    </div>
                    <div className="w-fit max-w-[82%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-[#111b21] shadow-sm">
                      {current.ai}
                      <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#667781]">
                        <span className="rounded bg-teal-brand/15 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-[#009e90]">
                          AI
                        </span>
                        now
                      </span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
