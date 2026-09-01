'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Destination, Tier, tierMultipliers } from '@/lib/data';
import { formatPrice } from '@/lib/pricing';

interface ItineraryProps {
  destination: Destination;
  tier: Tier;
  travelers: number;
  nights: number;
  total: number;
}

const inclusionsByTier: Record<Tier, string[]> = {
  essential: ['Return flights', 'Boutique hotel', 'Airport transfers', 'Daily breakfast'],
  premium: [
    'Return flights',
    'Luxury hotel or villa',
    'Private transfers',
    'Daily breakfast',
    'Half-day guided experience',
    'Welcome amenity',
  ],
  luxe: [
    'Business-class flights',
    'Luxury villa or suite',
    'Private chauffeur',
    'Daily breakfast & dinner',
    'Private guide full day',
    'Spa or wellness credit',
    '24/7 concierge',
  ],
};

export default function Itinerary({ destination, tier, travelers, nights, total }: ItineraryProps) {
  const displayedDays = Math.min(nights + 1, destination.itinerary.length);
  const visibleItinerary = destination.itinerary.slice(0, displayedDays);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay: 0.15 }}
      className="rounded-3xl border border-gold-400/20 bg-white p-7 shadow-2xl md:p-8"
    >
      <div className="relative mb-6 overflow-hidden rounded-2xl">
        <img
          src={destination.image}
          alt={destination.name}
          className="h-40 w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/80 to-transparent" />
        <div className="absolute bottom-4 left-4">
          <h3 className="font-serif text-2xl text-white">{destination.name}</h3>
          <p className="text-sm text-white/80">{destination.tagline}</p>
        </div>
      </div>

      <div className="mb-8 border-b border-sand-100 pb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">Estimated total</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={total}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="mt-1 font-serif text-5xl font-medium tracking-tight text-navy-900"
          >
            {formatPrice(total)}
          </motion.p>
        </AnimatePresence>
        <p className="mt-2 text-sm text-navy-800">
          {travelers} traveler{travelers > 1 ? 's' : ''} · {nights} night{nights > 1 ? 's' : ''} ·{' '}
          <span className="font-medium capitalize text-gold-600">{tier}</span>
        </p>
      </div>

      <div className="mb-8">
        <h4 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
          <span className="h-[1px] w-5 bg-gold-400" />
          Day-by-day
        </h4>
        <motion.ul
          key={`${destination.id}-${nights}-${tier}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {visibleItinerary.map((day, i) => (
            <li key={`${destination.id}-${i}`} className="flex gap-3 text-sm text-navy-900">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-xs font-bold text-gold-600">
                {i + 1}
              </span>
              <span className="leading-relaxed">{day}</span>
            </li>
          ))}
        </motion.ul>
      </div>

      <div className="mb-8">
        <h4 className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">
          <span className="h-[1px] w-5 bg-gold-400" />
          Included
        </h4>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {inclusionsByTier[tier].map((item) => (
            <li key={item} className="flex items-center gap-2.5 text-sm text-navy-800">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-gold-500"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <a
        href="#contact"
        className="btn-gradient block w-full rounded-full py-4 text-center text-sm font-semibold tracking-wide text-navy-950 transition-transform hover:scale-[1.02]"
      >
        Request this trip
      </a>
    </motion.div>
  );
}
