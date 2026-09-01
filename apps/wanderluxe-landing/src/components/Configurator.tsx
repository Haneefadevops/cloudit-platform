'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Reveal from './Reveal';
import Itinerary from './Itinerary';
import { destinations, type Tier } from '@/lib/data';
import { calculateTotal, formatPrice } from '@/lib/pricing';

const tiers: { id: Tier; label: string; description: string }[] = [
  { id: 'essential', label: 'Essential', description: 'Comfort & style' },
  { id: 'premium', label: 'Premium', description: 'Upgraded stays' },
  { id: 'luxe', label: 'Luxe', description: 'All-inclusive luxury' },
];

export default function Configurator() {
  const [destinationId, setDestinationId] = useState('maldives');
  const [tier, setTier] = useState<Tier>('premium');
  const [travelers, setTravelers] = useState(2);
  const [nights, setNights] = useState(5);

  const total = useMemo(
    () => calculateTotal({ destinationId, tier, travelers, nights }),
    [destinationId, tier, travelers, nights]
  );

  const selectedDestination = destinations.find((d) => d.id === destinationId)!;

  return (
    <section id="configurator" className="relative overflow-hidden bg-navy-950 py-24 md:py-32">
      {/* Subtle background texture */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, #D4AF37 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      <div aria-hidden className="absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-gold-500/5 blur-[120px]" />
      <div aria-hidden className="absolute -left-40 bottom-0 h-[400px] w-[400px] rounded-full bg-gold-500/5 blur-[100px]" />

      <div className="relative mx-auto max-w-7xl px-5">
        <Reveal className="mb-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-300">
            Build your escape
          </p>
          <h2 className="heading-md mt-4 mx-auto max-w-3xl text-white">
            Design your dream trip
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/60">
            Choose a destination, select your experience level, and watch your bespoke itinerary update in real time.
          </p>
          <div className="divider-gold mt-6 opacity-60" />
        </Reveal>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7 }}
            className="rounded-3xl border border-white/10 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl lg:col-span-7"
          >
            {/* Destination */}
            <div className="mb-10">
              <label className="mb-4 block text-sm font-semibold uppercase tracking-[0.15em] text-gold-300">
                Destination
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {destinations.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDestinationId(d.id)}
                    className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${
                      destinationId === d.id
                        ? 'border-gold-400/60 bg-white/10 shadow-glow'
                        : 'border-white/10 bg-white/[0.02] hover:border-white/30'
                    }`}
                  >
                    <img
                      src={d.image}
                      alt={d.name}
                      className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
                        destinationId === d.id ? 'opacity-50' : 'opacity-30 group-hover:opacity-40'
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy-950/90 to-transparent" />
                    <span className="relative z-10 block font-serif text-lg text-white">{d.name}</span>
                    <span className="relative z-10 block text-xs text-white/60">{d.duration}</span>
                    {destinationId === d.id && (
                      <span className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-gold-400 text-navy-950">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Tier */}
            <div className="mb-10">
              <label className="mb-4 block text-sm font-semibold uppercase tracking-[0.15em] text-gold-300">
                Experience
              </label>
              <div className="grid grid-cols-3 gap-3">
                {tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTier(t.id)}
                    className={`relative rounded-2xl border px-4 py-4 text-center transition-all duration-300 ${
                      tier === t.id
                        ? 'border-gold-400/60 bg-gold-400/10 text-white shadow-glow'
                        : 'border-white/10 bg-white/[0.02] text-white/60 hover:border-white/30 hover:text-white'
                    }`}
                  >
                    <span className="block font-serif text-lg">{t.label}</span>
                    <span className="mt-1 block text-xs opacity-70">{t.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-10 sm:grid-cols-2">
              {/* Travelers */}
              <div>
                <label className="mb-4 block text-sm font-semibold uppercase tracking-[0.15em] text-gold-300">
                  Travelers
                </label>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1.5">
                  <button
                    type="button"
                    onClick={() => setTravelers((v) => Math.max(1, v - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Decrease travelers"
                  >
                    −
                  </button>
                  <span className="w-14 text-center font-serif text-xl font-medium text-white">{travelers}</span>
                  <button
                    type="button"
                    onClick={() => setTravelers((v) => Math.min(12, v + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Increase travelers"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Nights */}
              <div>
                <label className="mb-4 block text-sm font-semibold uppercase tracking-[0.15em] text-gold-300">
                  Nights
                </label>
                <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] p-1.5">
                  <button
                    type="button"
                    onClick={() => setNights((v) => Math.max(2, v - 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Decrease nights"
                  >
                    −
                  </button>
                  <span className="w-14 text-center font-serif text-xl font-medium text-white">{nights}</span>
                  <button
                    type="button"
                    onClick={() => setNights((v) => Math.min(21, v + 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
                    aria-label="Increase nights"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-28">
              <Itinerary
                destination={selectedDestination}
                tier={tier}
                travelers={travelers}
                nights={nights}
                total={total}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
