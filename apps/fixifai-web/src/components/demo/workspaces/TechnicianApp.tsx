'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import AssetTimeline from '../AssetTimeline';
import PhoneFrame from '../PhoneFrame';
import {
  JOBS,
  Job,
  TOUR_JOB,
  TRADE_CHECKLISTS,
  assetById,
  customerBySite,
  siteById,
} from '../demo-data';

type StopState = 'done' | 'active' | 'upcoming';

interface Stop {
  job: Job;
  time: string;
  state: StopState;
}

const INITIAL_STOPS: Stop[] = [
  { job: JOBS.find((j) => j.id === 'j1034')!, time: '8:00 AM', state: 'done' },
  { job: { ...TOUR_JOB, technicianId: 'kasun', status: 'assigned' }, time: '10:00 AM', state: 'active' },
  { job: JOBS.find((j) => j.id === 'j1035')!, time: '1:30 PM', state: 'upcoming' },
];

const AI_REPORT =
  'AI report: Diagnosed faulty thermistor and low refrigerant on circuit 2. Replaced thermistor, recharged R410A (450 g), cleaned filters and coils. 15-minute test run — supply air at 12.4°C, suite cooling normally. Recommend compressor inspection at next quarterly service.';

/** Simple canvas signature pad. */
function SignaturePad({ onSigned }: { onSigned: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const ctx = () => canvasRef.current!.getContext('2d')!;

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          Customer signature
        </p>
        {hasInk && (
          <button
            type="button"
            onClick={() => {
              const c = canvasRef.current!;
              ctx().clearRect(0, 0, c.width, c.height);
              setHasInk(false);
            }}
            className="text-[10px] font-semibold text-gray-400 hover:text-brand-dark"
          >
            Clear
          </button>
        )}
      </div>
      <canvas
        ref={canvasRef}
        className="mt-2 h-24 w-full cursor-crosshair touch-none rounded-lg border border-dashed border-gray-300 bg-gray-50"
        onPointerDown={(e) => {
          drawing.current = true;
          const p = point(e);
          ctx().beginPath();
          ctx().moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = point(e);
          const c = ctx();
          c.strokeStyle = '#013c3c';
          c.lineWidth = 2;
          c.lineTo(p.x, p.y);
          c.stroke();
          if (!hasInk) {
            setHasInk(true);
            onSigned();
          }
        }}
        onPointerUp={() => (drawing.current = false)}
        onPointerLeave={() => (drawing.current = false)}
      />
      {!hasInk && <p className="mt-1 text-center text-[9px] text-gray-400">Sign here with a finger</p>}
    </div>
  );
}

/** Technician App workspace — the PWA Kasun uses in the field. */
export default function TechnicianApp() {
  const [phase, setPhase] = useState<'punch' | 'jobs' | 'job' | 'summary'>('punch');
  const [stops, setStops] = useState<Stop[]>(INITIAL_STOPS);
  const [activeStop, setActiveStop] = useState<number | null>(null);

  // punch
  const [punching, setPunching] = useState(false);
  const [punchTime, setPunchTime] = useState<string | null>(null);

  // job workflow
  const [navigating, setNavigating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ticks, setTicks] = useState<boolean[]>([]);
  const [photos, setPhotos] = useState({ before: false, after: false });
  const [voice, setVoice] = useState<'idle' | 'recording' | 'done'>('idle');
  const [signed, setSigned] = useState(false);

  // job timer
  useEffect(() => {
    if (!checkedIn) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [checkedIn]);

  const stop = activeStop !== null ? stops[activeStop] : null;
  const asset = stop ? assetById(stop.job.assetId) : null;
  const customer = stop ? customerBySite(stop.job.siteId) : null;
  const checklist = stop ? TRADE_CHECKLISTS[stop.job.trade] : [];

  const punchIn = () => {
    if (punching || punchTime) return;
    setPunching(true);
    setTimeout(() => {
      setPunching(false);
      setPunchTime('7:42 AM');
      setPhase('jobs');
    }, 1200);
  };

  const openStop = (i: number) => {
    setActiveStop(i);
    // reset per-job workflow (derive checklist from the stop being opened)
    setNavigating(false);
    setLocating(false);
    setCheckedIn(false);
    setElapsed(0);
    setTicks(TRADE_CHECKLISTS[stops[i].job.trade].map(() => false));
    setPhotos({ before: false, after: false });
    setVoice('idle');
    setSigned(false);
    setPhase('job');
  };

  const checkIn = () => {
    if (checkedIn || locating) return;
    setLocating(true);
    setTimeout(() => {
      setLocating(false);
      setCheckedIn(true);
    }, 1100);
  };

  const completeJob = () => {
    if (activeStop === null) return;
    setStops((ss) => ss.map((s, i) => (i === activeStop ? { ...s, state: 'done' } : s)));
    setActiveStop(null);
    setCheckedIn(false); // stops the job timer
    setPhase('jobs');
  };

  const doneCount = stops.filter((s) => s.state === 'done').length;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  return (
    <PhoneFrame title="FixifAI — Technician" caption="The technician PWA — Kasun's workday">
      {/* ── DAY START / GPS PUNCH ─────────────────────── */}
      {phase === 'punch' && (
        <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
          <p className="font-heading text-sm font-bold text-brand-dark">Good morning, Kasun</p>
          <p className="mt-0.5 text-[11px] text-gray-500">Wednesday, 05 Aug 2026 · 3 stops today</p>
          <motion.button
            type="button"
            onClick={punchIn}
            whileTap={{ scale: 0.96 }}
            className="btn-glow mt-5 rounded-xl px-8 py-3 text-xs font-bold text-white"
          >
            {punching ? 'Locating…' : punchTime ? `Punched in ${punchTime} ✓` : 'Punch in — GPS'}
          </motion.button>
          {punching && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 font-mono text-[9px] text-gray-400">
              Acquiring GPS lock…
            </motion.p>
          )}
          {punchTime && <p className="mt-2 font-mono text-[9px] text-gray-400">6.9271° N, 79.8612° E</p>}
        </div>
      )}

      {/* ── TODAY'S JOBS ──────────────────────────────── */}
      {phase === 'jobs' && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Today · in visit order
            </p>
            <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[9px] font-bold text-brand-teal">
              Punched in {punchTime}
            </span>
          </div>

          {stops.map((s, i) => (
            <button
              key={s.job.id}
              type="button"
              onClick={() => s.state !== 'done' && openStop(i)}
              className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-colors ${
                s.state === 'done'
                  ? 'border-gray-100 bg-gray-50 opacity-70'
                  : s.state === 'active'
                    ? 'border-brand-orange/50 bg-white hover:border-brand-orange'
                    : 'border-gray-100 bg-white hover:border-brand-teal/50'
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
                  s.state === 'done' ? 'bg-brand-teal' : 'bg-brand-dark'
                }`}
              >
                {s.state === 'done' ? '✓' : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-brand-dark">
                  {s.job.title}
                </span>
                <span className="block text-[10px] text-gray-500">
                  {siteById(s.job.siteId).name} · {s.time}
                </span>
              </span>
              {s.state === 'active' && (
                <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[9px] font-bold text-brand-orange">
                  NEXT
                </span>
              )}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setPhase('summary')}
            className="w-full rounded-xl bg-brand-dark px-3 py-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-teal"
          >
            Finish day → summary
          </button>
        </div>
      )}

      {/* ── JOB SCREEN ────────────────────────────────── */}
      {phase === 'job' && stop && asset && customer && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setPhase('jobs')}
            className="text-[10px] font-semibold text-brand-teal hover:underline"
          >
            ← Today&apos;s jobs
          </button>

          {/* job + customer info */}
          <div className="rounded-xl border-2 border-brand-orange/40 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold text-brand-teal">{stop.job.ref}</span>
              <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[9px] font-bold text-brand-orange">
                {stop.job.priority.toUpperCase()}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-brand-dark">{stop.job.title}</p>
            <p className="text-[10px] text-gray-500">
              {customer.contactPerson} · {customer.phone}
            </p>
            <p className="text-[10px] text-gray-500">
              {siteById(stop.job.siteId).name} · {asset.name}
            </p>
            <p className="mt-1.5">
              {asset.inWarranty ? (
                <span className="rounded-full bg-brand-teal/10 px-2 py-0.5 text-[9px] font-bold text-brand-teal">
                  In warranty until {asset.warrantyUntil}
                </span>
              ) : (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[9px] font-bold text-gray-500">
                  AMC covered — {asset.amcPlan.split('·')[0]}
                </span>
              )}
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
                onClick={checkIn}
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

            {checkedIn && (
              <p className="mt-2 text-center">
                <span className="rounded-full bg-brand-dark px-3 py-1 font-mono text-[11px] font-bold text-white">
                  ⏱ {mm}:{ss}
                </span>
              </p>
            )}
          </div>

          {/* asset history */}
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Asset history — {asset.name}
            </p>
            <AssetTimeline history={asset.history} compact />
          </div>

          {/* checklist */}
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {stop.job.trade} checklist
            </p>
            <ul className="mt-2 space-y-1.5">
              {checklist.map((item, i) => (
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

          {/* photos */}
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Site photos</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(['before', 'after'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setPhotos((p) => ({ ...p, [kind]: !p[kind] }))}
                  className={`flex h-14 flex-col items-center justify-center rounded-lg border text-[9px] font-semibold transition-colors ${
                    photos[kind]
                      ? 'border-brand-teal/40 bg-gradient-to-br from-brand-teal/20 to-brand-dark/20 text-brand-teal'
                      : 'border-dashed border-gray-300 text-gray-400 hover:border-brand-teal/50'
                  }`}
                >
                  {photos[kind] ? <>📷 {kind} ✓</> : <>+ {kind} photo</>}
                </button>
              ))}
            </div>
          </div>

          {/* voice report → AI text */}
          <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <button
              type="button"
              onClick={() => {
                if (voice !== 'idle') return;
                setVoice('recording');
                setTimeout(() => setVoice('done'), 1600);
              }}
              className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[11px] font-semibold transition-colors ${
                voice === 'done'
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
              {voice === 'done' && 'Voice note processed ✓'}
            </button>
            {voice === 'done' && (
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 rounded-lg bg-brand-teal/5 px-3 py-2 text-[10px] leading-relaxed text-gray-600"
              >
                {AI_REPORT}
              </motion.p>
            )}
          </div>

          {/* signature + complete */}
          <SignaturePad onSigned={() => setSigned(true)} />
          <button
            type="button"
            onClick={completeJob}
            disabled={!checkedIn || !signed}
            className={`w-full rounded-xl px-3 py-2.5 text-[11px] font-bold transition-colors ${
              checkedIn && signed
                ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 hover:bg-brand-orange/90'
                : 'cursor-not-allowed bg-gray-100 text-gray-400'
            }`}
          >
            {!checkedIn
              ? 'GPS check-in required to complete'
              : !signed
                ? 'Customer signature required'
                : 'Complete job ✓'}
          </button>
        </div>
      )}

      {/* ── DAY SUMMARY ───────────────────────────────── */}
      {phase === 'summary' && (
        <div className="space-y-3">
          <p className="text-center font-heading text-sm font-bold text-brand-dark">
            Day summary — Kasun
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-gray-100 bg-white p-2.5 text-center">
              <p className="font-heading text-lg font-bold text-brand-teal">{doneCount}</p>
              <p className="text-[9px] uppercase tracking-wide text-gray-400">Jobs done</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-2.5 text-center">
              <p className="font-heading text-lg font-bold text-brand-dark">6.5h</p>
              <p className="text-[9px] uppercase tracking-wide text-gray-400">On the clock</p>
            </div>
            <div className="rounded-lg border border-gray-100 bg-white p-2.5 text-center">
              <p className="font-heading text-lg font-bold text-brand-orange">9.6k</p>
              <p className="text-[9px] uppercase tracking-wide text-gray-400">Est. LKR today</p>
            </div>
          </div>
          <ul className="space-y-1.5">
            {stops.map((s) => (
              <li
                key={s.job.id}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[11px] shadow-sm ring-1 ring-gray-100"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                    s.state === 'done' ? 'bg-brand-teal' : 'bg-gray-300'
                  }`}
                >
                  {s.state === 'done' ? '✓' : '·'}
                </span>
                <span className={s.state === 'done' ? 'text-brand-dark' : 'text-gray-400'}>
                  {s.job.title}
                </span>
                <span className="ml-auto text-[10px] text-gray-400">{s.time}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setPhase('jobs')}
            className="w-full rounded-xl bg-brand-dark px-3 py-2.5 text-[11px] font-semibold text-white transition-colors hover:bg-brand-teal"
          >
            ← Back to today&apos;s jobs
          </button>
        </div>
      )}
    </PhoneFrame>
  );
}
