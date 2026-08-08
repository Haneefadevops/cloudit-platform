'use client';

import {
  REPORT_JOBS_PER_WEEK,
  REPORT_REPEAT_FAULTS,
  REPORT_REVENUE,
  assetById,
  lkr,
} from '../../../demo-data';

function BarChart({
  data,
  max,
  valueLabel,
  barClass,
}: {
  data: { week: string; value: number }[];
  max: number;
  valueLabel: (v: number) => string;
  barClass: string;
}) {
  return (
    <div className="flex h-32 items-end gap-2">
      {data.map((d) => (
        <div key={d.week} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[8px] font-semibold text-gray-500">{valueLabel(d.value)}</span>
          <div
            className={`w-full rounded-t-md ${barClass}`}
            style={{ height: `${Math.max(8, Math.round((d.value / max) * 80))}%` }}
          />
          <span className="text-[9px] font-semibold text-gray-400">{d.week}</span>
        </div>
      ))}
    </div>
  );
}

/** Reports screen — jobs per week, revenue and repeat-fault insights. */
export default function ReportsScreen() {
  const totalRevenue = REPORT_REVENUE.reduce((s, r) => s + r.lkr, 0);
  const totalJobs = REPORT_JOBS_PER_WEEK.reduce((s, r) => s + r.jobs, 0);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Jobs · 6 weeks</p>
          <p className="mt-0.5 font-heading text-lg font-bold text-brand-teal">{totalJobs}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Revenue · 6 weeks</p>
          <p className="mt-0.5 font-heading text-lg font-bold text-brand-dark">{lkr(totalRevenue)}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">First-time fix</p>
          <p className="mt-0.5 font-heading text-lg font-bold text-brand-teal">91%</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">SLA breaches</p>
          <p className="mt-0.5 font-heading text-lg font-bold text-brand-orange">2</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-3.5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Jobs completed per week
          </p>
          <BarChart
            data={REPORT_JOBS_PER_WEEK.map((r) => ({ week: r.week, value: r.jobs }))}
            max={Math.max(...REPORT_JOBS_PER_WEEK.map((r) => r.jobs))}
            valueLabel={(v) => String(v)}
            barClass="bg-brand-teal/80"
          />
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3.5">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Revenue per week
          </p>
          <BarChart
            data={REPORT_REVENUE.map((r) => ({ week: r.week, value: r.lkr }))}
            max={Math.max(...REPORT_REVENUE.map((r) => r.lkr))}
            valueLabel={(v) => `${Math.round(v / 1000)}k`}
            barClass="bg-brand-orange/80"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white p-3.5">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Repeat faults — act before the customer complains
        </p>
        <ul className="space-y-2">
          {REPORT_REPEAT_FAULTS.map((f) => {
            const asset = assetById(f.assetId);
            return (
              <li key={f.assetId} className="flex items-start gap-3 rounded-lg bg-brand-orange/5 px-3 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 text-[11px] font-bold text-brand-orange">
                  {f.count}×
                </span>
                <div>
                  <p className="text-xs font-bold text-brand-dark">{asset.name}</p>
                  <p className="text-[11px] leading-snug text-gray-600">{f.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
