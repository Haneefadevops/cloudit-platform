import Reveal from './Reveal';

const steps = [
  {
    n: '01',
    title: 'Tell us your dream',
    copy: 'Share your destination, travel dates, and what makes a trip unforgettable for you.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    n: '02',
    title: 'We curate it',
    copy: 'Our travel experts design a bespoke itinerary tailored to your style and budget.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    n: '03',
    title: 'Travel effortlessly',
    copy: 'Enjoy your journey with 24/7 concierge support, transfers, and every detail handled.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92Z" />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-sand-200 bg-sand-50 py-24 md:py-32">
      <div className="relative mx-auto max-w-7xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">
            How it works
          </p>
          <h2 className="heading-md mt-4 text-navy-900">
            Three steps to <span className="text-gradient">your escape</span>
          </h2>
          <div className="divider-gold mt-6" />
        </Reveal>

        <div className="mt-16 grid gap-10 sm:grid-cols-3 lg:gap-8">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="relative">
                {i < steps.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute left-[calc(50%+3.5rem)] top-9 hidden h-[1px] w-[calc(100%-7rem)] bg-gradient-to-r from-gold-400/40 to-gold-500/40 lg:block"
                  />
                )}
                <div className="flex flex-col items-center text-center">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-gold-400/30 bg-white shadow-soft">
                    <span className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-navy-950">
                      {s.n}
                    </span>
                    <span className="text-gold-500">{s.icon}</span>
                  </div>
                  <h3 className="mt-8 font-serif text-2xl text-navy-900">{s.title}</h3>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-navy-800">{s.copy}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
