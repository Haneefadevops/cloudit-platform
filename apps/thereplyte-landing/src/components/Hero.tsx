'use client';

import { motion } from 'framer-motion';
import ChatMockup from './ChatMockup';
import { WA_LINK } from './Logo';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
      {/* Background mesh */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-indigo-brand/20 blur-[140px]" />
        <div className="absolute right-1/4 top-20 h-80 w-80 rounded-full bg-teal-brand/15 blur-[130px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2 lg:gap-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
          >
            <span className="glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-[#5a5e7a]">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gradient" />
              AI Agent for WhatsApp
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight text-[#12142b] sm:text-5xl lg:text-6xl"
          >
            Hire an <span className="text-gradient">AI employee</span> for your WhatsApp
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-[#5a5e7a]"
          >
            Answers customers instantly in their language, takes orders and bookings, and hands
            off to your team when it matters — 24/7.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a
              href={WA_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gradient inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold text-white"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.23.65-1.35 1.24-1.87 1.28-.5.05-.97.23-3.28-.68-2.77-1.1-4.53-3.9-4.67-4.08-.14-.18-1.12-1.5-1.12-2.85s.71-2.02.96-2.3c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.23.55.78 1.9.85 2.04.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.28.7 1.16 1.5 1.88 1.04.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.8.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.16 1.3Z" />
              </svg>
              Chat with us on WhatsApp
            </a>
            <a
              href="#how"
              className="glass inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-[#12142b] transition-colors hover:border-[#c9cdf0]"
            >
              See how it works
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <ChatMockup />
        </motion.div>
      </div>
    </section>
  );
}
