import Reveal from './Reveal';

const testimonials = [
  {
    quote: 'WanderLuxe planned our honeymoon down to the smallest detail. The overwater villa and private dinners were beyond anything we imagined.',
    name: 'Elena & Marco',
    location: 'Milan, Italy',
    initial: 'E',
  },
  {
    quote: 'Every transfer, every meal, every excursion was seamless. I have never traveled with such peace of mind.',
    name: 'Sarah Jenkins',
    location: 'New York, USA',
    initial: 'S',
  },
  {
    quote: 'The team curated a Swiss Alps experience that felt like a dream. The concierge service alone is worth every penny.',
    name: 'David Chen',
    location: 'Singapore',
    initial: 'D',
  },
];

export default function Testimonials() {
  return (
    <section id="testimonials" className="bg-sand-50 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">
            Traveler stories
          </p>
          <h2 className="heading-md mt-4 text-navy-900">
            Loved by travelers
          </h2>
          <div className="divider-gold mt-6" />
        </Reveal>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.12}>
              <div className="glass flex h-full flex-col rounded-3xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-soft">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="text-gold-400/80"
                  aria-hidden="true"
                >
                  <path d="M10 11H5.5a2.5 2.5 0 1 1 0-5H8V3H5.5A5.5 5.5 0 0 0 0 8.5v1A2.5 2.5 0 0 0 2.5 12H5v8h5v-9ZM21 11h-4.5a2.5 2.5 0 1 1 0-5H19V3h-2.5A5.5 5.5 0 0 0 11 8.5v1a2.5 2.5 0 0 0 2.5 2.5H16v8h5v-9Z" />
                </svg>
                <p className="mt-6 flex-1 font-serif text-xl leading-relaxed text-navy-900">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-8 flex items-center gap-4 border-t border-sand-100 pt-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 font-serif text-lg font-medium text-gold-600">
                    {t.initial}
                  </span>
                  <div>
                    <p className="font-semibold text-navy-900">{t.name}</p>
                    <p className="text-sm text-navy-800">{t.location}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
