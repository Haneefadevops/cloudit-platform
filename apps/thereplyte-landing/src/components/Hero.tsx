'use client';

import { motion } from 'framer-motion';
import ChatMockup from './ChatMockup';

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
      {/* Background mesh */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-56 w-56 rounded-full bg-indigo-brand/20 blur-[80px] md:h-96 md:w-96 md:blur-[140px]" />
        <div className="absolute right-1/4 top-20 h-48 w-48 rounded-full bg-teal-brand/15 blur-[70px] md:h-80 md:w-80 md:blur-[130px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 lg:grid-cols-2 lg:gap-8">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="text-4xl font-extrabold leading-[1.08] tracking-tight text-[#12142b] sm:text-5xl lg:text-6xl"
          >
            Hire an <span className="text-gradient">AI Employee</span> for Your WhatsApp
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16 }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-[#5a5e7a]"
          >
            Never miss another customer. Answer questions instantly, take bookings and orders,
            qualify leads, and hand conversations to your team all automatically, 24/7.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <a
              href="#possibilities"
              className="btn-gradient inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-sm font-semibold text-white"
            >
              Explore Possibilities
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a
              href="#how"
              className="btn-gradient-rev inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-semibold text-white"
            >
              See it in Action
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
          className="flex justify-center lg:justify-end"
        >
          <ChatMockup />
        </motion.div>
      </div>
    </section>
  );
}
