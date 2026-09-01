'use client';

import { motion } from 'framer-motion';
import Reveal from './Reveal';
import { destinations } from '@/lib/data';

function DestinationCard({
  d,
  index,
  featured = false,
}: {
  d: (typeof destinations)[0];
  index: number;
  featured?: boolean;
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
      whileHover={{ y: -10 }}
      className={`group relative flex flex-col justify-end overflow-hidden rounded-3xl bg-navy-900 shadow-soft transition-shadow duration-500 hover:shadow-glow ${
        featured ? 'min-h-[520px] lg:col-span-2' : 'min-h-[420px]'
      }`}
    >
      <img
        src={d.image}
        alt={d.name}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 ease-out group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/95 via-navy-900/30 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-navy-950/40 to-transparent" />

      <div className="relative z-10 p-7 md:p-8">
        <div className="flex items-center gap-2">
          <span className="h-[1px] w-8 bg-gold-400" />
          <span className="text-xs font-semibold uppercase tracking-[0.25em] text-gold-300">
            {d.duration}
          </span>
        </div>
        <h3 className={`mt-3 font-serif text-white ${featured ? 'text-4xl md:text-5xl' : 'text-3xl'}`}>
          {d.name}
        </h3>
        <p className="mt-2 max-w-md text-white/75">{d.tagline}</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {d.highlights.slice(0, 3).map((h) => (
            <span
              key={h}
              className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur-sm"
            >
              {h}
            </span>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
          <span className="text-lg font-medium text-gold-300">
            From ${d.priceFrom.toLocaleString()}
            <span className="ml-1 text-sm font-normal text-white/60">/ person</span>
          </span>
          <a
            href="#configurator"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm transition-all hover:bg-white/20"
          >
            Customize
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14m0 0-7-7m7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </motion.article>
  );
}

export default function Destinations() {
  return (
    <section id="destinations" className="relative bg-sand-50 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">
            Curated escapes
          </p>
          <h2 className="heading-md mt-4 mx-auto max-w-3xl text-navy-900">
            Featured destinations
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-navy-800">
            Hand-picked luxury experiences across the world&apos;s most breathtaking places.
          </p>
          <div className="divider-gold mt-6" />
        </Reveal>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {destinations.map((d, i) => (
            <DestinationCard key={d.id} d={d} index={i} featured={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
