'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import AssetTimeline from '../AssetTimeline';
import BrowserFrame from '../BrowserFrame';
import QRBadge from '../QRBadge';
import {
  ASSETS,
  Asset,
  INVOICES,
  JOBS,
  Job,
  PORTAL_JOB_REF,
  PORTAL_TRACKING_NO,
  QUOTATIONS,
  Quotation,
  TRACKER_STAGES,
  lkr,
  quotationTotals,
  siteById,
  trackerStage,
} from '../demo-data';

const PORTAL_SITE = 'grand-pearl';
const portalAssets = ASSETS.filter((a) => a.siteId === PORTAL_SITE);
const seedJobs = JOBS.filter((j) => j.siteId === PORTAL_SITE).reverse(); // newest first
const portalQuotation = QUOTATIONS.find((q) => q.id === 'q1')!;
const portalInvoice = INVOICES.find((i) => i.id === 'inv1')!;

type Tab = 'report' | 'assets' | 'jobs' | 'billing';

const TABS: { id: Tab; label: string }[] = [
  { id: 'report', label: 'Report issue' },
  { id: 'assets', label: 'My Assets' },
  { id: 'jobs', label: 'My Jobs' },
  { id: 'billing', label: 'Quotations & Invoices' },
];

/** 4-stage job progress tracker (reported → scheduled → on the way → done). */
function Tracker({ stage }: { stage: number }) {
  return (
    <div className="mt-2.5 flex items-center">
      {TRACKER_STAGES.map((label, i) => (
        <div key={label} className={`flex items-center ${i > 0 ? 'flex-1' : ''}`}>
          {i > 0 && (
            <span className={`h-0.5 flex-1 ${i <= stage ? 'bg-brand-teal' : 'bg-gray-200'}`} />
          )}
          <div className="flex flex-col items-center gap-1">
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full border-2 text-[8px] font-bold ${
                i < stage
                  ? 'border-brand-teal bg-brand-teal text-white'
                  : i === stage
                    ? 'border-brand-orange bg-white text-brand-orange'
                    : 'border-gray-200 bg-white text-transparent'
              }`}
            >
              ✓
            </span>
            <span
              className={`whitespace-nowrap text-[8px] font-semibold ${
                i <= stage ? 'text-brand-dark' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function WarrantyBadge({ asset }: { asset: Asset }) {
  return asset.inWarranty ? (
    <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold text-brand-teal">
      In warranty · until {asset.warrantyUntil}
    </span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">
      Warranty expired {asset.warrantyUntil} · covered by AMC
    </span>
  );
}

/**
 * Customer Portal workspace — the branded service page a CityFix client
 * (Grand Pearl Hotel) sees at fixifai.com/service/cityfix.
 */
export default function CustomerPortal() {
  const [tab, setTab] = useState<Tab>('report');
  // report flow
  const [flowAsset, setFlowAsset] = useState<Asset | null>(null);
  const [flowStage, setFlowStage] = useState<'pick' | 'chat' | 'done'>('pick');
  const [reply, setReply] = useState<string | null>(null);
  const [myJobs, setMyJobs] = useState<Job[]>(seedJobs);
  // assets
  const [openAsset, setOpenAsset] = useState<Asset | null>(null);
  // billing
  const [quoteStatus, setQuoteStatus] = useState<Quotation['status']>(portalQuotation.status);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [invoicePaid, setInvoicePaid] = useState(false);

  const startFlow = (asset: Asset) => {
    setFlowAsset(asset);
    setReply(null);
    setFlowStage('chat');
  };

  const answerAI = (answer: string) => {
    setReply(answer);
    setFlowStage('done');
    const newJob: Job = {
      id: 'j-portal',
      ref: PORTAL_JOB_REF,
      title: `${flowAsset!.name} — ${answer.toLowerCase()}`,
      siteId: PORTAL_SITE,
      assetId: flowAsset!.id,
      trade: flowAsset!.type,
      priority: 'high',
      status: 'new',
      technicianId: null,
      created: 'Just now',
    };
    setMyJobs((jobs) => [newJob, ...jobs]);
  };

  const totals = quotationTotals(portalQuotation);

  return (
    <BrowserFrame url="fixifai.com/service/cityfix" caption="What your customers see — CityFix's branded service portal">
      {/* CityFix branded header */}
      <div className="flex items-center gap-3 rounded-xl bg-brand-dark px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-orange font-heading text-sm font-bold text-white">
          CF
        </span>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-bold text-white">
            CityFix Maintenance Services
          </p>
          <p className="text-[10px] text-white/60">
            {siteById(PORTAL_SITE).name} · service portal powered by <span className="font-semibold text-white/80">FixifAI</span>
          </p>
        </div>
        <span className="ml-auto hidden rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/70 sm:block">
          Amaya R. — Chief Engineer
        </span>
      </div>

      {/* portal nav */}
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? 'bg-brand-teal text-white shadow-sm'
                : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:text-brand-teal'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {/* ── REPORT ISSUE ─────────────────────────────── */}
        {tab === 'report' && (
          <div>
            {flowStage === 'pick' && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="font-heading text-sm font-bold text-brand-dark">What needs fixing?</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Pick the asset — or scan the QR code stuck on it.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {portalAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => startFlow(asset)}
                      className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-colors hover:border-brand-teal/50"
                    >
                      <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[9px] font-bold text-brand-teal">
                        {asset.type}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-brand-dark">{asset.name}</span>
                        <span className="block font-mono text-[10px] text-gray-400">{asset.qrCode}</span>
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => startFlow(portalAssets[1])}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-teal/40 bg-brand-teal/5 p-3 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal/10"
                  >
                    ⌗ Scan QR instead
                  </button>
                </div>
              </div>
            )}

            {flowStage !== 'pick' && flowAsset && (
              <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-brand-dark">{flowAsset.name}</p>
                  <button
                    type="button"
                    onClick={() => setFlowStage('pick')}
                    className="text-[10px] font-semibold text-gray-400 hover:text-brand-dark"
                  >
                    ← change asset
                  </button>
                </div>

                <div className="mt-3 space-y-2">
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mr-10 rounded-2xl rounded-bl-sm border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-snug text-brand-dark"
                  >
                    <span className="mr-1 rounded bg-brand-orange/10 px-1 py-0.5 text-[8px] font-bold text-brand-orange">
                      AI
                    </span>
                    Sorry to hear there&apos;s a problem with the {flowAsset.name}. I have its full
                    service history here. Is the unit leaking water or not cooling?
                  </motion.div>

                  {reply && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="ml-10 rounded-2xl rounded-br-sm bg-brand-teal px-3 py-2 text-xs text-white"
                      >
                        {reply}
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mr-10 rounded-2xl rounded-bl-sm border border-gray-100 bg-gray-50 px-3 py-2 text-xs leading-snug text-brand-dark"
                      >
                        <span className="mr-1 rounded bg-brand-orange/10 px-1 py-0.5 text-[8px] font-bold text-brand-orange">
                          AI
                        </span>
                        Got it. I&apos;ve logged everything and notified the CityFix team — a
                        technician will be assigned shortly.
                      </motion.div>
                    </>
                  )}
                </div>

                {flowStage === 'chat' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Not cooling', 'Leaking water', 'Strange noise'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => answerAI(opt)}
                        className="rounded-full border border-brand-teal/40 px-3.5 py-1.5 text-xs font-semibold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {flowStage === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.9 }}
                    className="mt-3 rounded-xl border-2 border-brand-teal/30 bg-brand-teal/5 p-4 text-center"
                  >
                    <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal text-sm font-bold text-white">
                      ✓
                    </span>
                    <p className="mt-1.5 font-heading text-sm font-bold text-brand-dark">
                      Job {PORTAL_JOB_REF} created
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Tracking no: <span className="font-mono font-semibold">{PORTAL_TRACKING_NO}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab('jobs')}
                      className="btn-glow mt-3 rounded-lg px-5 py-2 text-xs font-semibold text-white"
                    >
                      Track this job →
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MY ASSETS ────────────────────────────────── */}
        {tab === 'assets' && (
          <AnimatePresence mode="wait">
            {openAsset ? (
              <motion.div
                key="asset-detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => setOpenAsset(null)}
                  className="text-xs font-semibold text-brand-teal hover:underline"
                >
                  ← All assets
                </button>
                <div className="mt-3 flex flex-col gap-4 sm:flex-row">
                  <div className="shrink-0 self-start text-center">
                    <QRBadge code={openAsset.qrCode} size={88} />
                    <p className="mt-2">
                      <WarrantyBadge asset={openAsset} />
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-sm font-bold text-brand-dark">{openAsset.name}</p>
                    <p className="text-xs text-gray-500">
                      {siteById(openAsset.siteId).name} · {openAsset.type}
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-gray-400">Installed</dt>
                        <dd className="font-medium text-brand-dark">{openAsset.installDate}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] uppercase tracking-wide text-gray-400">Lifetime spend</dt>
                        <dd className="font-medium text-brand-dark">{lkr(openAsset.lifetimeSpend)}</dd>
                      </div>
                      <div className="col-span-2">
                        <dt className="text-[10px] uppercase tracking-wide text-gray-400">AMC coverage</dt>
                        <dd className="font-medium text-brand-dark">{openAsset.amcPlan}</dd>
                      </div>
                    </dl>
                    <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      Service history
                    </p>
                    <AssetTimeline history={openAsset.history} />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="asset-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid gap-2 sm:grid-cols-3"
              >
                {portalAssets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => setOpenAsset(asset)}
                    className="rounded-xl border border-gray-100 bg-white p-3.5 text-left shadow-sm transition-colors hover:border-brand-teal/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[9px] font-bold text-brand-teal">
                        {asset.type}
                      </span>
                      <span
                        className={`h-2 w-2 rounded-full ${
                          asset.status === 'operational' ? 'bg-brand-teal' : 'bg-brand-orange'
                        }`}
                      />
                    </div>
                    <p className="mt-2 text-xs font-bold text-brand-dark">{asset.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-gray-400">{asset.qrCode}</p>
                    <p className="mt-2 text-[10px] font-semibold text-brand-teal">View history & QR →</p>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* ── MY JOBS ──────────────────────────────────── */}
        {tab === 'jobs' && (
          <div className="space-y-2">
            {myJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-brand-teal">{job.ref}</span>
                  <span className="text-xs font-bold text-brand-dark">{job.title}</span>
                  <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                    {job.created}
                  </span>
                </div>
                <Tracker stage={trackerStage(job.status)} />
              </div>
            ))}
            <p className="pt-1 text-center text-[10px] text-gray-400">
              Your customer gets these live updates on their tracking link — no phone calls needed.
            </p>
          </div>
        )}

        {/* ── BILLING ──────────────────────────────────── */}
        {tab === 'billing' && (
          <div className="space-y-3">
            {/* quotation */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand-teal">{portalQuotation.ref}</span>
                <span className="text-xs font-bold text-brand-dark">{portalQuotation.title}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    quoteStatus === 'approved'
                      ? 'bg-brand-teal/10 text-brand-teal'
                      : quoteStatus === 'rejected'
                        ? 'bg-red-50 text-red-500'
                        : 'bg-brand-orange/10 text-brand-orange'
                  }`}
                >
                  {quoteStatus === 'sent' ? 'AWAITING YOUR APPROVAL' : quoteStatus.toUpperCase()}
                </span>
              </div>

              {!quoteOpen ? (
                <button
                  type="button"
                  onClick={() => setQuoteOpen(true)}
                  className="mt-2.5 text-xs font-semibold text-brand-teal hover:underline"
                >
                  View quotation document →
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-3 rounded-lg border border-gray-200 bg-gray-50/50 p-3.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-heading text-xs font-bold text-brand-dark">QUOTATION</p>
                      <p className="text-[10px] text-gray-400">
                        {portalQuotation.date} · valid until {portalQuotation.validUntil}
                      </p>
                    </div>
                    <p className="text-right text-[10px] text-gray-400">
                      CityFix Maintenance Services (Pvt) Ltd
                      <br />
                      42/1 Galle Road, Colombo 03
                    </p>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[380px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-400">
                          <th className="pb-1.5 pr-2 font-semibold">Description</th>
                          <th className="pb-1.5 pr-2 text-right font-semibold">Qty</th>
                          <th className="pb-1.5 text-right font-semibold">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portalQuotation.lines.map((line, i) => (
                          <tr key={i} className="border-b border-gray-100 text-brand-dark">
                            <td className="py-1.5 pr-2">{line.description}</td>
                            <td className="py-1.5 pr-2 text-right">{line.qty}</td>
                            <td className="py-1.5 text-right font-medium">
                              {(line.qty * line.unitPrice).toLocaleString('en-US')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 space-y-1 text-right text-xs">
                    <p className="text-gray-500">Subtotal: {lkr(totals.subtotal)}</p>
                    <p className="text-gray-500">VAT (18%): {lkr(totals.vat)}</p>
                    <p className="font-heading text-sm font-bold text-brand-dark">
                      Total: {lkr(totals.total)}
                    </p>
                  </div>
                  {quoteStatus === 'sent' && (
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setQuoteStatus('rejected')}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-500 transition-colors hover:border-red-300 hover:text-red-500"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuoteStatus('approved')}
                        className="btn-glow rounded-lg px-4 py-2 text-xs font-semibold text-white"
                      >
                        Approve quotation ✓
                      </button>
                    </div>
                  )}
                  {quoteStatus === 'approved' && (
                    <p className="mt-3 rounded-lg bg-brand-teal/10 px-3 py-2 text-center text-xs font-semibold text-brand-teal">
                      Approved — CityFix has been notified to schedule the work.
                    </p>
                  )}
                  {quoteStatus === 'rejected' && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-500">
                      Rejected — CityFix will contact you to revise the quotation.
                    </p>
                  )}
                </motion.div>
              )}
            </div>

            {/* invoice */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-brand-teal">{portalInvoice.ref}</span>
                <span className="text-xs font-bold text-brand-dark">{portalInvoice.title}</span>
                <span className="text-[10px] text-gray-400">job {portalInvoice.jobRef}</span>
                <span
                  className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    invoicePaid ? 'bg-brand-teal/10 text-brand-teal' : 'bg-brand-orange/10 text-brand-orange'
                  }`}
                >
                  {invoicePaid ? 'PAID' : `DUE ${portalInvoice.dueDate}`}
                </span>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <p className="font-heading text-base font-bold text-brand-dark">
                  {lkr(portalInvoice.amount)}
                </p>
                {!invoicePaid ? (
                  <button
                    type="button"
                    onClick={() => setInvoicePaid(true)}
                    className="btn-glow ml-auto rounded-lg px-5 py-2 text-xs font-semibold text-white"
                  >
                    Pay now
                  </button>
                ) : (
                  <p className="ml-auto text-xs font-semibold text-brand-teal">
                    Paid via PayHere · receipt emailed ✓
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </BrowserFrame>
  );
}
