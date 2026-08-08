'use client';

import { SCHEDULE, TECHNICIANS, WEEK_DAYS, siteById } from '../../../demo-data';

/**
 * Schedule screen — week grid: rows = technicians, columns = Mon–Sat,
 * job chips placed per slot. Scrolls horizontally on small screens.
 */
export default function ScheduleScreen() {
  return (
    <div className="rounded-xl bg-white/70 p-3 ring-1 ring-gray-100">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Week schedule · 03 – 08 Aug 2026
        </p>
        <div className="flex gap-2 text-[9px] font-semibold text-gray-400">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" /> AM
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" /> PM
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          {/* day header */}
          <div className="grid grid-cols-[130px_repeat(6,1fr)] gap-1">
            <div />
            {WEEK_DAYS.map((d) => (
              <div
                key={d}
                className="rounded-md bg-brand-dark/90 py-1 text-center text-[10px] font-bold text-white"
              >
                {d}
              </div>
            ))}
          </div>

          {/* technician rows */}
          {TECHNICIANS.map((tech) => (
            <div key={tech.id} className="mt-1 grid grid-cols-[130px_repeat(6,1fr)] gap-1">
              <div className="flex items-center gap-1.5 rounded-md bg-white px-2 py-1.5 ring-1 ring-gray-100">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-orange/90 text-[8px] font-bold text-white">
                  {tech.initials}
                </span>
                <span className="truncate text-[10px] font-semibold text-brand-dark">
                  {tech.name.split(' ')[0]}
                </span>
              </div>
              {WEEK_DAYS.map((_, day) => {
                const entries = SCHEDULE.filter((s) => s.technicianId === tech.id && s.day === day);
                return (
                  <div key={day} className="min-h-[44px] rounded-md bg-white/60 p-1 ring-1 ring-gray-100">
                    {entries.map((e) => (
                      <div
                        key={e.id}
                        title={`${e.title} — ${siteById(e.siteId).name}`}
                        className={`mb-1 cursor-default rounded px-1.5 py-1 text-[9px] font-semibold leading-tight text-white ${
                          e.slot === 'AM' ? 'bg-brand-orange/90' : 'bg-brand-teal/90'
                        }`}
                      >
                        <span className="font-mono">{e.ref}</span> {e.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[10px] text-gray-400">
        Drag a job onto a technician&apos;s slot in the real app — the tech is notified instantly.
      </p>
    </div>
  );
}
