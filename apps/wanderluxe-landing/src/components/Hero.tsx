'use client';

import { motion } from 'framer-motion';

const titleWords = ['Curated', 'Journeys,'];
const subtitleWords = ['Effortless', 'Memories'];

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      {/* Cinematic background */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=2400&q=85"
          alt="Maldives overwater villas at sunset"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-navy-950/80 via-navy-900/40 to-navy-950/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950/70 via-transparent to-navy-950/30" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,transparent_0%,rgba(5,8,17,0.4)_100%)]" />
      </div>

      {/* Decorative gold line */}
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1.2, delay: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
        className="absolute left-1/2 top-1/2 z-10 h-[1px] w-32 -translate-x-1/2 -translate-y-[180px] bg-gradient-to-r from-transparent via-gold-400 to-transparent md:w-48 md:-translate-y-[220px]"
      />

      <div className="relative z-10 mx-auto max-w-6xl px-5 text-center">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="mb-6 text-sm font-medium uppercase tracking-[0.35em] text-gold-300"
        >
          Bespoke Luxury Travel
        </motion.p>

        <h1 className="heading-xl mx-auto max-w-5xl text-white">
          <span className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            {titleWords.map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 + i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
              >
                {word}
              </motion.span>
            ))}
          </span>
          <span className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-gradient-light">
            {subtitleWords.map((word, i) => (
              <motion.span
                key={word}
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
              >
                {word}
              </motion.span>
            ))}
          </span>
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mx-auto mt-8 max-w-2xl text-lg font-light leading-relaxed text-white/80 md:text-xl"
        >
          From private villas in the Maldives to alpine chalets in the Alps, we craft journeys
          shaped entirely around you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <a
            href="#destinations"
            className="btn-gradient inline-flex items-center gap-3 rounded-full px-8 py-4 text-sm font-semibold tracking-wide text-navy-950"
          >
            Explore Destinations
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14m0 0 6-6m-6 6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a
            href="#configurator"
            className="group inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/5 px-8 py-4 text-sm font-semibold tracking-wide text-white backdrop-blur-md transition-all hover:border-white/50 hover:bg-white/10"
          >
            Build My Trip
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            >
              <path d="M5 12h14m0 0-7-7m7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 z-10 -translate-x-1/2"
      >
        <a href="#destinations" aria-label="Scroll to destinations" className="flex flex-col items-center gap-2 text-white/60 transition-colors hover:text-white">
          <span className="text-[10px] uppercase tracking-[0.25em]">Discover</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
            </svg>
          </motion.div>
        </a>
      </motion.div>
    </section>
  );
}
