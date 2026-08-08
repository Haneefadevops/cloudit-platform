'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import PhoneFrame from '../PhoneFrame';
import { TOUR_JOB, assetById, siteById } from '../demo-data';

const asset = assetById(TOUR_JOB.assetId);
const site = siteById(TOUR_JOB.siteId);

const CHECKLIST = [
  'Inspect unit & error codes',
  'Check refrigerant pressure',
  'Clean filters & coils',
  'Test-run for 15 minutes',
];

/**
 * Tour step 3 — Kasun's phone: the assigned job with Navigate,
 * GPS check-in, a tappable checklist, before/after photos and
 * a voice report button.
 */
export default function StepTechnician({
  checkedIn,
  onCheckIn,
}: {
  checkedIn: boolean;
  onCheckIn: () => void;
}) {
  const [locating, setLocating] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [ticks, setTicks] = useState<boolean[]>(() => CHECKLIST.map(() => false));
  const [photos, setPhotos] = useState({ before: false, after: false });
  const [voice, setVoice] = useState<'idle' | 'recording' | 'saved'>('idle');

  const handleCheckIn = () => {
    if (checkedIn || locating) return;
    setLocating(true);
    setTimeout(() => {
      setLocating(false);
      onCheckIn();
    }, 1100);
  };

  const handleVoice = () => {
    if (voice === 'idle') {
      setVoice('recording');
      setTimeout(() => setVoice('saved'), 1600);
    }
  };

  return (
    <PhoneFrame title="FixifAI — Technician" caption="Kasun's phone — everything on one screen">
      <div className="space-y-3">
        {/* job card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-brand-orange/40 bg-white p-3 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold text-brand-teal">{TOUR_JOB.ref}</span>
            <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[9px] font-bold text-brand-orange">
              HIGH PRIORITY
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-brand-dark">{TOUR_JOB.title}</p>
          <p className="text-[10px] text-gray-500">
            {site.name} · {asset.name}
          </p>

          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setNavigating(true)}
              className="rounded-lg bg-brand-dark px-2 py-2 text-[10px] font-semibold text-white transition-colors hover:bg-brand-teal"
            >
              {navigating ? 'Opening Maps…' : 'Navigate'}
            </button>
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={checkedIn}
              className={`rounded-lg px-2 py-2 text-[10px] font-semibold transition-colors ${
                checkedIn
                  ? 'cursor-default bg-brand-teal/10 text-brand-teal'
                  : 'bg-brand-orange text-white hover:bg-brand-orange/90'
              }`}
            >
              {checkedIn ? 'Checked in ✓' : locating ? 'Locating…' : 'GPS check-in'}
            </button>
          </div>

          {(locating || checkedIn) && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-2 rounded-lg bg-gray-50 px-2 py-1.5 text-center font-mono text-[9px] text-gray-500"
            >
              {checkedIn ? '6.9271° N, 79.8612° E · verified on site' : 'Acquiring GPS lock…'}
            </motion.p>
          )}
        </motion.div>

        {/* checklist */}
        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            AC service checklist
          </p>
          <ul className="mt-2 space-y-1.5">
            {CHECKLIST.map((item, i) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => setTicks((t) => t.map((v, j) => (j === i ? !v : v)))}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-[11px] text-brand-dark hover:bg-gray-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] font-bold transition-colors ${
                      ticks[i]
                        ? 'border-brand-teal bg-brand-teal text-white'
                        : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={ticks[i] ? 'text-gray-400 line-through' : ''}>{item}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* before / after photos */}
        <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Site photos
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(['before', 'after'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => setPhotos((p) => ({ ...p, [kind]: !p[kind] }))}
                className={`flex h-16 flex-col items-center justify-center rounded-lg border text-[9px] font-semibold transition-colors ${
                  photos[kind]
                    ? 'border-brand-teal/40 bg-gradient-to-br from-brand-teal/20 to-brand-dark/20 text-brand-teal'
                    : 'border-dashed border-gray-300 text-gray-400 hover:border-brand-teal/50'
                }`}
              >
                {photos[kind] ? (
                  <>
                    <span className="text-sm">📷</span>
                    {kind} ✓
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-300">+</span>
                    {kind} photo
                  </>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* voice report */}
        <button
          type="button"
          onClick={handleVoice}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold transition-colors ${
            voice === 'saved'
              ? 'cursor-default bg-brand-teal/10 text-brand-teal'
              : 'bg-brand-dark text-white hover:bg-brand-teal'
          }`}
        >
          {voice === 'recording' && (
            <motion.span
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
              className="h-2 w-2 rounded-full bg-brand-orange"
            />
          )}
          {voice === 'idle' && '🎙 Voice report'}
          {voice === 'recording' && 'Recording… speak now'}
          {voice === 'saved' && 'Voice note attached ✓'}
        </button>
      </div>
    </PhoneFrame>
  );
}
