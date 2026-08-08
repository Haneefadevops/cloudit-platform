'use client';

import { motion } from 'framer-motion';
import { TECHNICIANS } from './demo-data';

/**
 * Stylized technician location map — abstract roads + pulsing pins,
 * deliberately not a real map library.
 */
const PINS: Record<string, { x: string; y: string }> = {
  kasun: { x: '24%', y: '30%' },
  nimal: { x: '62%', y: '22%' },
  tharindu: { x: '78%', y: '58%' },
  sachini: { x: '40%', y: '68%' },
  ruwan: { x: '15%', y: '62%' },
  dilshan: { x: '55%', y: '45%' },
};

export default function MiniMap({ focusId }: { focusId?: string | null }) {
  return (
    <div className="relative h-44 overflow-hidden rounded-xl bg-[#e3f2f1] ring-1 ring-gray-200">
      {/* abstract road grid */}
      <div aria-hidden className="absolute left-0 top-[30%] h-[3px] w-full bg-white" />
      <div aria-hidden className="absolute left-0 top-[68%] h-[3px] w-full bg-white" />
      <div aria-hidden className="absolute left-[28%] top-0 h-full w-[3px] bg-white" />
      <div aria-hidden className="absolute left-[70%] top-0 h-full w-[3px] bg-white" />
      <div aria-hidden className="absolute left-[10%] top-[10%] h-10 w-16 rounded-lg bg-[#cfe8e6]" />
      <div aria-hidden className="absolute bottom-[12%] right-[8%] h-12 w-20 rounded-lg bg-[#cfe8e6]" />
      <span className="absolute left-2 top-2 rounded-full bg-white/80 px-2 py-0.5 text-[9px] font-semibold text-gray-500">
        Colombo — live
      </span>

      {TECHNICIANS.map((tech) => {
        const pos = PINS[tech.id];
        const focused = tech.id === focusId;
        return (
          <div key={tech.id} className="absolute" style={{ left: pos.x, top: pos.y }}>
            {focused && (
              <motion.span
                className="absolute -inset-2 rounded-full bg-brand-orange/30"
                animate={{ scale: [1, 1.8], opacity: [0.7, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <span
              className={`relative block h-3 w-3 rounded-full border-2 border-white shadow ${
                tech.status === 'off-duty'
                  ? 'bg-gray-400'
                  : focused
                    ? 'bg-brand-orange'
                    : 'bg-brand-teal'
              }`}
              title={`${tech.name} — ${tech.status}`}
            />
            <span className="absolute left-3.5 top-0 whitespace-nowrap rounded bg-white/90 px-1 text-[8px] font-semibold text-brand-dark shadow-sm">
              {tech.name.split(' ')[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
