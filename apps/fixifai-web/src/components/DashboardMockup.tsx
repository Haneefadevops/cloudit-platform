'use client';

import { motion } from 'framer-motion';

/**
 * Tilted 3D dashboard mockup built from pure divs/Tailwind —
 * a browser-chrome frame with a mini sidebar, stat bars and a kanban sketch.
 * Illustrative only, no real data.
 */
export default function DashboardMockup() {
  return (
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="[transform:perspective(1400px)_rotateY(-14deg)_rotateX(7deg)] max-lg:[transform:perspective(1400px)_rotateY(-5deg)_rotateX(3deg)] max-sm:[transform:none]"
    >
      <div className="overflow-hidden rounded-2xl border border-white/20 bg-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.5)]">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-[10px] font-medium text-gray-400 ring-1 ring-gray-200">
            app.fixifai.cloudit.lk/dashboard
          </div>
        </div>

        <div className="flex">
          {/* sidebar sketch */}
          <div className="hidden w-28 shrink-0 flex-col gap-2 bg-brand-dark p-3 sm:flex">
            <div className="mb-1 h-2.5 w-14 rounded-full bg-brand-teal" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-2 rounded-full ${i === 0 ? 'w-16 bg-brand-orange' : 'w-12 bg-white/25'}`}
              />
            ))}
            <div className="mt-auto h-6 w-full rounded-md bg-brand-teal/40" />
          </div>

          {/* main panel */}
          <div className="flex-1 bg-[#f4fbfb] p-4">
            {/* stat bars */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="h-1.5 w-8 rounded-full bg-gray-200" />
                <div className="mt-2 h-3.5 w-12 rounded-full bg-brand-teal" />
              </div>
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="h-1.5 w-8 rounded-full bg-gray-200" />
                <div className="mt-2 h-3.5 w-10 rounded-full bg-brand-orange" />
              </div>
              <div className="rounded-lg border border-gray-100 bg-white p-3">
                <div className="h-1.5 w-8 rounded-full bg-gray-200" />
                <div className="mt-2 h-3.5 w-14 rounded-full bg-brand-dark" />
              </div>
            </div>

            {/* kanban sketch */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { dot: 'bg-brand-orange', cards: 3 },
                { dot: 'bg-brand-teal', cards: 2 },
                { dot: 'bg-gray-300', cards: 3 },
              ].map((col, i) => (
                <div key={i} className="rounded-lg bg-white/70 p-2 ring-1 ring-gray-100">
                  <div className="mb-2 flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                    <div className="h-1.5 w-8 rounded-full bg-gray-200" />
                  </div>
                  <div className="space-y-2">
                    {Array.from({ length: col.cards }).map((_, j) => (
                      <div key={j} className="rounded-md border border-gray-100 bg-white p-2 shadow-sm">
                        <div className="h-1.5 w-full rounded-full bg-gray-200" />
                        <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-gray-100" />
                        <div className="mt-2 flex items-center justify-between">
                          <div className="h-1.5 w-5 rounded-full bg-brand-teal/40" />
                          <div className="h-3 w-3 rounded-full bg-brand-orange/70" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
