'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import QRBadge from '../../../QRBadge';
import { ASSETS, CUSTOMERS, Customer, JOBS, siteById } from '../../../demo-data';

/** Customers screen — list of clients; each opens a detail with sites and assets. */
export default function CustomersScreen() {
  const [selected, setSelected] = useState<Customer | null>(null);

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CUSTOMERS.map((customer) => {
          const openJobs = JOBS.filter(
            (j) => customer.siteIds.includes(j.siteId) && j.status !== 'done',
          ).length;
          return (
            <button
              key={customer.id}
              type="button"
              onClick={() => setSelected((cur) => (cur?.id === customer.id ? null : customer))}
              className={`rounded-xl border bg-white p-3.5 text-left shadow-sm transition-colors ${
                selected?.id === customer.id
                  ? 'border-brand-teal ring-1 ring-brand-teal'
                  : 'border-gray-100 hover:border-brand-teal/40'
              }`}
            >
              <p className="text-xs font-bold text-brand-dark">{customer.name}</p>
              <p className="mt-0.5 text-[10px] text-gray-500">{customer.contactPerson}</p>
              <div className="mt-2 flex items-center gap-2 text-[10px]">
                <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 font-semibold text-brand-teal">
                  {openJobs} open job{openJobs === 1 ? '' : 's'}
                </span>
                <span className="text-gray-400">client since {customer.since}</span>
              </div>
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
            className="relative mt-3 rounded-xl border border-brand-teal/25 bg-white p-4 shadow-md"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close customer detail"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>

            <p className="pr-8 font-heading text-sm font-bold text-brand-dark">{selected.name}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-gray-400">Contact</dt>
                <dd className="font-medium text-brand-dark">{selected.contactPerson}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wide text-gray-400">Phone</dt>
                <dd className="font-medium text-brand-dark">{selected.phone}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-wide text-gray-400">Email</dt>
                <dd className="font-medium text-brand-dark">{selected.email}</dd>
              </div>
            </dl>

            {selected.siteIds.map((siteId) => {
              const site = siteById(siteId);
              const assets = ASSETS.filter((a) => a.siteId === siteId);
              return (
                <div key={siteId} className="mt-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {site.name} — {site.kind} · {site.city}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {assets.map((asset) => (
                      <div
                        key={asset.id}
                        className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50/60 p-2.5"
                      >
                        <QRBadge code={asset.qrCode} size={40} />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-bold text-brand-dark">{asset.name}</p>
                          <p className="text-[9px] text-gray-500">
                            {asset.inWarranty ? 'In warranty' : 'AMC'} ·{' '}
                            {asset.status === 'operational' ? 'operational' : 'needs attention'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
