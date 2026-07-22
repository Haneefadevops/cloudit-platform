import Reveal from './Reveal';

type Feature = {
  title: string;
  copy: string;
  span: string;
  highlight?: boolean;
  icon: JSX.Element;
};

const stroke = {
  stroke: 'url(#icon-grad)',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const features: Feature[] = [
  {
    title: 'Multilingual AI',
    copy: 'Auto-detects your customer’s language and replies in it — 50+ languages out of the box. English, Sinhala, Tamil, Arabic, Spanish and more, with zero setup.',
    span: 'md:col-span-2',
    highlight: true,
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...stroke} />
        <path d="M3.5 12h17M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Instant AI answers',
    copy: 'Trained on your website, documents and FAQs — accurate answers in seconds, not hours.',
    span: '',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Orders & bookings',
    copy: 'Takes orders, books appointments and collects customer details right inside the chat.',
    span: '',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" {...stroke} />
        <path d="M3.5 9.5h17M8 3v4M16 3v4M8.5 14.5l2.2 2.2 4.3-4.2" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Smart human handoff',
    copy: 'Complex question? It hands off to your team inbox with a full AI summary and smart labels — and goes quiet the moment a human replies.',
    span: 'md:col-span-2',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="3.2" {...stroke} />
        <path d="M2.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" {...stroke} />
        <path d="M15.5 8.5 21 8.5m0 0-2.5-2.5M21 8.5l-2.5 2.5" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Voice notes & images',
    copy: 'Understands voice notes via transcription and reads images with vision.',
    span: '',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="9" y="2.5" width="6" height="11" rx="3" {...stroke} />
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" {...stroke} />
      </svg>
    ),
  },
  {
    title: 'Analytics & CSAT',
    copy: 'Resolution rate, response times, CSAT and AI cost tracking — know exactly what your AI employee earns you.',
    span: 'md:col-span-2',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3.5 20.5h17" {...stroke} />
        <path d="M6 20.5v-6M11 20.5v-10M16 20.5v-13M21 20.5v-8" {...stroke} />
      </svg>
    ),
  },
];

export default function Features() {
  return (
    <section id="features" className="relative py-24 md:py-32">
      <svg width="0" height="0" aria-hidden="true" className="absolute">
        <defs>
          <linearGradient id="icon-grad" x1="0" y1="0" x2="26" y2="26" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00d8c7" />
            <stop offset="1" stopColor="#4a42fc" />
          </linearGradient>
        </defs>
      </svg>

      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-brand">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#12142b] sm:text-4xl lg:text-5xl">
            Everything a great hire does. <span className="text-gradient">Without the payroll.</span>
          </h2>
          <p className="mt-4 text-lg text-[#5a5e7a]">
            One AI that answers, sells, books and knows when to step aside for your team.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08} className={f.span}>
              <div
                className={`group relative h-full overflow-hidden rounded-2xl p-7 transition-all duration-300 ${
                  f.highlight
                    ? 'border border-teal-brand/30 bg-gradient-to-br from-teal-brand/[0.07] to-indigo-brand/[0.09] shadow-[0_4px_24px_rgba(74,66,252,0.06)]'
                    : 'glass'
                } hover:border-indigo-brand/30 hover:shadow-[0_12px_40px_-12px_rgba(74,66,252,0.25)]`}
              >
                <div
                  aria-hidden
                  className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-brand/0 blur-3xl transition-all duration-500 group-hover:bg-indigo-brand/10"
                />
                <div className="glass flex h-12 w-12 items-center justify-center rounded-xl">
                  {f.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#12142b]">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#5a5e7a]">{f.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
