'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import {
  QUOTATIONS,
  Quotation,
  customerById,
  lkr,
  quotationTotals,
  siteById,
} from '../../../demo-data';

const STATUS_STYLES: Record<Quotation['status'], string> = {
  draft: 'bg-gray-100 text-gray-500',
  sent: 'bg-brand-orange/10 text-brand-orange',
  approved: 'bg-brand-teal/10 text-brand-teal',
  rejected: 'bg-red-50 text-red-500',
};

/** Quotations screen — list with statuses; each opens a full quotation document. */
export default function QuotationsScreen() {
  const [selected, setSelected] = useState<Quotation | null>(null);

  return (
    <div>
      <div className="space-y-2">
        {QUOTATIONS.map((q) => {
          const t = quotationTotals(q);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelected((cur) => (cur?.id === q.id ? null : q))}
              className={`flex w-full flex-wrap items-center gap-2 rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors ${
                selected?.id === q.id
                  ? 'border-brand-teal ring-1 ring-brand-teal'
                  : 'border-gray-100 hover:border-brand-teal/40'
              }`}
            >
              <span className="font-mono text-xs font-bold text-brand-teal">{q.ref}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold text-brand-dark">{q.title}</span>
                <span className="block text-[10px] text-gray-500">{customerById(q.customerId).name}</span>
              </span>
              <span className="font-heading text-sm font-bold text-brand-dark">{lkr(t.total)}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${STATUS_STYLES[q.status]}`}>
                {q.status}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="relative mt-3 rounded-xl border border-brand-teal/25 bg-white p-4 shadow-md sm:p-5"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close quotation"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>

            {/* quotation document */}
            <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
              <div>
                <p className="font-heading text-sm font-bold text-brand-dark">QUOTATION {selected.ref}</p>
                <p className="text-[10px] text-gray-400">
                  {selected.date} · valid until {selected.validUntil}
                </p>
              </div>
              <div className="text-right text-[10px] leading-snug text-gray-400">
                CityFix Maintenance Services (Pvt) Ltd
                <br />
                42/1 Galle Road, Colombo 03 · 011 234 5678
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs">
              <span className="text-gray-400">To: </span>
              <span className="font-semibold text-brand-dark">{customerById(selected.customerId).name}</span>
              <span className="text-gray-400"> · {siteById(selected.siteId).name}</span>
              <span className="block text-[11px] font-semibold text-brand-dark">{selected.title}</span>
            </div>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="pb-1.5 pr-2 font-semibold">Description</th>
                    <th className="pb-1.5 pr-2 text-right font-semibold">Qty</th>
                    <th className="pb-1.5 pr-2 text-right font-semibold">Unit price</th>
                    <th className="pb-1.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.lines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-100 text-brand-dark">
                      <td className="py-1.5 pr-2">{line.description}</td>
                      <td className="py-1.5 pr-2 text-right">{line.qty}</td>
                      <td className="py-1.5 pr-2 text-right">{line.unitPrice.toLocaleString('en-US')}</td>
                      <td className="py-1.5 text-right font-medium">
                        {(line.qty * line.unitPrice).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 space-y-1 text-right text-xs">
              <p className="text-gray-500">Subtotal: {lkr(quotationTotals(selected).subtotal)}</p>
              <p className="text-gray-500">VAT (18%): {lkr(quotationTotals(selected).vat)}</p>
              <p className="font-heading text-base font-bold text-brand-dark">
                Total: {lkr(quotationTotals(selected).total)}
              </p>
            </div>
            <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[10px] text-gray-500">
              Sent to the customer&apos;s portal — they approve with one tap, and the job is
              scheduled automatically.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
