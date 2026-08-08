'use client';

import { motion } from 'framer-motion';
import PhoneFrame from '../PhoneFrame';
import QRBadge from '../QRBadge';
import { TOUR_JOB, TOUR_TRACKING_NO, assetById } from '../demo-data';

const asset = assetById(TOUR_JOB.assetId);

function Stage({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Tour step 1 — the customer's phone: scan a QR on the hotel AC,
 * AI triage chat, job #1042 created with a tracking number.
 */
export default function StepCustomer() {
  return (
    <PhoneFrame title="FixifAI — Customer" caption="Customer's phone — no app install needed">
      <div className="space-y-3">
        {/* QR scan result */}
        <Stage delay={0.1}>
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-teal">
              QR scanned
            </p>
            <div className="mt-2 flex items-center gap-3">
              <QRBadge code={asset.qrCode} size={56} />
              <div>
                <p className="text-xs font-semibold text-brand-dark">{asset.name}</p>
                <p className="text-[10px] text-gray-500">Grand Pearl Hotel · Rooftop</p>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  Last service: 28 Jun 2026
                </p>
              </div>
            </div>
          </div>
        </Stage>

        {/* report form */}
        <Stage delay={0.7}>
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Report a problem
            </p>
            <div className="mt-2 rounded-lg bg-brand-orange/10 px-2.5 py-1.5 text-[11px] font-semibold text-brand-orange">
              AC not cooling
            </div>
            <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-2.5 py-1.5 text-[10px] text-gray-500">
              “Suite 1204 — running all morning, room still warm.”
            </div>
            <div className="mt-2 flex gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[9px] text-gray-400">
                + photo
              </div>
              <div className="flex h-9 items-center rounded-lg bg-gray-100 px-2 text-[9px] text-gray-400">
                IMG_1204.jpg
              </div>
            </div>
          </div>
        </Stage>

        {/* AI triage chat */}
        <div className="space-y-2 pt-1">
          <Stage delay={1.4}>
            <div className="ml-8 rounded-2xl rounded-br-sm bg-brand-teal px-3 py-2 text-[11px] leading-snug text-white shadow-sm">
              Suite 1204 AC — not cooling since morning.
            </div>
          </Stage>
          <Stage delay={2.2}>
            <div className="mr-8 rounded-2xl rounded-bl-sm border border-gray-100 bg-white px-3 py-2 text-[11px] leading-snug text-brand-dark shadow-sm">
              <span className="mr-1 rounded bg-brand-orange/10 px-1 py-0.5 text-[8px] font-bold text-brand-orange">
                AI
              </span>
              Got it — I can see this unit&apos;s full service history. Is the unit leaking
              water or not cooling?
            </div>
          </Stage>
          <Stage delay={3.1}>
            <div className="ml-8 rounded-2xl rounded-br-sm bg-brand-teal px-3 py-2 text-[11px] text-white shadow-sm">
              Not cooling.
            </div>
          </Stage>
        </div>

        {/* job created */}
        <Stage delay={3.9}>
          <div className="rounded-xl border-2 border-brand-teal/30 bg-brand-teal/5 p-3 text-center shadow-sm">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 4.1, type: 'spring', stiffness: 300, damping: 15 }}
              className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-brand-teal text-sm font-bold text-white"
            >
              ✓
            </motion.span>
            <p className="mt-1.5 font-heading text-xs font-bold text-brand-dark">
              Job {TOUR_JOB.ref} created
            </p>
            <p className="mt-0.5 text-[10px] text-gray-500">
              Tracking no: <span className="font-mono font-semibold">{TOUR_TRACKING_NO}</span>
            </p>
            <p className="mt-1 text-[10px] text-gray-400">
              CityFix has been notified — track progress from this link.
            </p>
          </div>
        </Stage>
      </div>
    </PhoneFrame>
  );
}
