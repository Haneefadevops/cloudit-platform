'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type Msg = {
  id: number;
  from: 'customer' | 'ai' | 'system';
  text: string;
};

type Script = {
  label: string;
  dir: 'ltr' | 'rtl';
  steps: { from: 'customer' | 'ai'; text: string }[];
};

const HANDOFF_TEXT =
  '🤖→👤 Complex question? It hands off to your team with a full summary.';

const SCRIPTS: Script[] = [
  {
    label: 'English',
    dir: 'ltr',
    steps: [
      { from: 'customer', text: 'Hi! Do you have any slots available this Friday?' },
      {
        from: 'ai',
        text: 'Yes! Dr. Perera has slots at 6:45pm and 7:30pm Friday. Which works for you?',
      },
      { from: 'customer', text: '7:30 please' },
      { from: 'ai', text: "Booked ✅ Friday 7:30pm with Dr. Perera. I'll remind you a day before!" },
    ],
  },
  {
    label: 'සිංහල',
    dir: 'ltr',
    steps: [
      { from: 'customer', text: 'Hi! Friday වලට appointment එකක් ගන්න පුළුවන්ද?' },
      {
        from: 'ai',
        text: 'පුළුවන්! Dr. Perera Friday 6:45pm සහ 7:30pm වලට available. කොයි එකද ඕන?',
      },
      { from: 'customer', text: '7:30ට ඕන' },
      {
        from: 'ai',
        text: 'Booked ✅ Friday 7:30pm Dr. Perera එක්ක. දවසකට කලින් reminder එකක් එවන්නම්!',
      },
    ],
  },
  {
    label: 'தமிழ்',
    dir: 'ltr',
    steps: [
      { from: 'customer', text: 'Hi! வெள்ளிக்கு appointment கிடைக்குமா?' },
      {
        from: 'ai',
        text: 'கிடைக்கும்! Dr. Perera வெள்ளி 6:45pm மற்றும் 7:30pm-க்கு free. எது ok?',
      },
      { from: 'customer', text: '7:30 please' },
      {
        from: 'ai',
        text: 'Booked ✅ வெள்ளி 7:30pm Dr. Perera உடன். ஒரு நாள் முன் reminder அனுப்புறேன்!',
      },
    ],
  },
  {
    label: 'العربية',
    dir: 'rtl',
    steps: [
      { from: 'customer', text: 'مرحباً! هل يوجد موعد متاح يوم الجمعة؟' },
      {
        from: 'ai',
        text: 'نعم! الدكتور بيريرا متاح يوم الجمعة 6:45م و 7:30م. أي وقت يناسبك؟',
      },
      { from: 'customer', text: '7:30 من فضلك' },
      {
        from: 'ai',
        text: 'تم الحجز ✅ الجمعة 7:30م مع الدكتور بيريرا. سأذكّرك قبلها بيوم!',
      },
    ],
  },
  {
    label: 'Español',
    dir: 'ltr',
    steps: [
      { from: 'customer', text: '¡Hola! ¿Hay citas disponibles el viernes?' },
      {
        from: 'ai',
        text: '¡Sí! El Dr. Perera tiene horas el viernes a las 6:45pm y 7:30pm. ¿Cuál te viene mejor?',
      },
      { from: 'customer', text: '7:30 por favor' },
      {
        from: 'ai',
        text: 'Reservado ✅ viernes 7:30pm con el Dr. Perera. ¡Te recuerdo un día antes!',
      },
    ],
  },
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    setN(0);
    const iv = setInterval(() => {
      setN((v) => (v >= text.length ? v : v + 2));
    }, 24);
    return () => clearInterval(iv);
  }, [text]);

  return (
    <>
      {text.slice(0, n)}
      {n < text.length && <span className="animate-pulse text-teal-brand">▍</span>}
    </>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md bg-[#005c4b] px-4 py-3"
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-white/80"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </motion.div>
  );
}

export default function ChatMockup() {
  const [cycle, setCycle] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const push = (m: Omit<Msg, 'id'>) => {
      if (cancelled) return;
      idRef.current += 1;
      setMessages((prev) => [...prev.slice(-5), { ...m, id: idRef.current }]);
    };

    async function run() {
      let lang = 0;
      while (!cancelled) {
        setCycle(lang);
        setMessages([]);
        setTyping(false);
        await sleep(600);
        const script = SCRIPTS[lang];
        for (const step of script.steps) {
          if (cancelled) return;
          if (step.from === 'ai') {
            setTyping(true);
            await sleep(950);
            if (cancelled) return;
            setTyping(false);
            push({ from: 'ai', text: step.text });
            // keep pace with the Typewriter reveal (~12ms/char) plus a beat
            await sleep(450 + step.text.length * 12);
          } else {
            push({ from: 'customer', text: step.text });
            await sleep(1150);
          }
        }
        if (cancelled) return;
        push({ from: 'system', text: HANDOFF_TEXT });
        await sleep(4000);
        lang = (lang + 1) % SCRIPTS.length;
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = SCRIPTS[cycle];

  return (
    <div className="relative mx-auto w-full max-w-[380px]">
      {/* Floating orbs */}
      <motion.div
        aria-hidden
        className="absolute -left-16 -top-12 h-56 w-56 rounded-full bg-teal-brand/25 blur-[90px]"
        animate={{ x: [0, 20, 0], y: [0, -16, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-14 -right-16 h-64 w-64 rounded-full bg-indigo-brand/30 blur-[100px]"
        animate={{ x: [0, -24, 0], y: [0, 18, 0] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0b141a] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 bg-[#1f2c34] px-4 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-night">
            C
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">CloudIT</p>
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              online
            </p>
          </div>
          <AnimatePresence mode="wait">
            <motion.span
              key={current.label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              className="glass rounded-full px-2.5 py-1 text-[11px] font-medium text-teal-brand"
            >
              {current.label}
            </motion.span>
          </AnimatePresence>
        </div>

        {/* Chat area */}
        <div
          className="relative flex h-[380px] flex-col justify-end gap-2 overflow-hidden px-3 pb-4 pt-8 [mask-image:linear-gradient(to_bottom,transparent,black_14%)]"
          style={{
            backgroundImage:
              'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={cycle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.4 } }}
              className="flex flex-col justify-end gap-2"
              dir={current.dir}
            >
              {messages.map((m) => {
                if (m.from === 'system') {
                  return (
                    <motion.div
                      key={m.id}
                      dir="ltr"
                      initial={{ opacity: 0, y: 14, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="glass mx-auto max-w-[85%] rounded-xl px-3.5 py-2.5 text-center text-[11px] leading-relaxed text-slate-300"
                    >
                      {m.text}
                    </motion.div>
                  );
                }
                const isAi = m.from === 'ai';
                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    className={`w-fit max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                      isAi
                        ? 'rounded-bl-md bg-[#005c4b] text-white'
                        : 'self-end rounded-br-md bg-[#202c33] text-slate-100'
                    }`}
                  >
                    {isAi ? <Typewriter text={m.text} /> : m.text}
                    <span className="mt-1 flex items-center justify-end gap-1 text-[9px] text-white/40">
                      {isAi && (
                        <span className="rounded bg-white/10 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-teal-brand">
                          AI
                        </span>
                      )}
                      now
                    </span>
                  </motion.div>
                );
              })}
              {typing && <TypingIndicator />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Input bar (decorative) */}
        <div className="flex items-center gap-2 border-t border-white/5 bg-[#1f2c34] px-3 py-2.5">
          <div className="h-9 flex-1 rounded-full bg-[#2a3942] px-4 text-xs leading-9 text-slate-500">
            Message
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-brand/90">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 11.5 21 3l-6.5 18-2.7-7.8L3 11.5Z" fill="#0a0a12" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
