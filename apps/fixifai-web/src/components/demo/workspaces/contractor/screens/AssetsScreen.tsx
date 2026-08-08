'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import AssetTimeline from '../../../AssetTimeline';
import QRBadge from '../../../QRBadge';
import { ASSETS, Asset, lkr, siteById } from '../../../demo-data';

/** Assets screen — grid with QR/status/warranty; clicking opens the full history. */
export default function AssetsScreen() {
  const [selected, setSelected] = useState<Asset | null>(null);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {ASSETS.map((asset) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => setSelected((cur) => (cur?.id === asset.id ? null : asset))}
            className={`rounded-xl border bg-white p-3 text-left shadow-sm transition-colors ${
              selected?.id === asset.id
                ? 'border-brand-teal ring-1 ring-brand-teal'
                : 'border-gray-100 hover:border-brand-teal/40'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="rounded-full bg-brand-teal/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-teal">
                {asset.type}
              </span>
              <span
                className={`h-2 w-2 rounded-full ${
                  asset.status === 'operational' ? 'bg-brand-teal' : 'bg-brand-orange'
                }`}
                title={asset.status}
              />
            </div>
            <p className="mt-1.5 text-[11px] font-bold leading-snug text-brand-dark">{asset.name}</p>
            <p className="mt-0.5 truncate text-[10px] text-gray-500">{siteById(asset.siteId).name}</p>
            <p
              className={`mt-1.5 text-[9px] font-semibold ${
                asset.inWarranty ? 'text-brand-teal' : 'text-gray-400'
              }`}
            >
              {asset.inWarranty ? `Warranty · ${asset.warrantyUntil}` : 'AMC covered'}
            </p>
          </button>
        ))}
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
              aria-label="Close asset detail"
              className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 hover:bg-gray-200"
            >
              ✕
            </button>
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="shrink-0 self-start">
                <QRBadge code={selected.qrCode} size={84} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-bold text-brand-dark">{selected.name}</p>
                <p className="text-xs text-gray-500">
                  {siteById(selected.siteId).name} · installed {selected.installDate}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      selected.inWarranty
                        ? 'bg-brand-teal/10 text-brand-teal'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {selected.inWarranty ? `In warranty · ${selected.warrantyUntil}` : `Warranty expired ${selected.warrantyUntil}`}
                  </span>
                  <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[10px] font-bold text-brand-orange">
                    {selected.amcPlan}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                    Lifetime spend {lkr(selected.lifetimeSpend)}
                  </span>
                </div>
                <p className="mb-2 mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Service history
                </p>
                <AssetTimeline history={selected.history} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
