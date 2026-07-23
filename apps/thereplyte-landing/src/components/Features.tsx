import Reveal from './Reveal';

type Feature = {
  title: string;
  copy: string;
  span: string;
  icon: JSX.Element;
  visual: JSX.Element;
};

const stroke = {
  stroke: 'url(#icon-grad)',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const languages = ['English', 'සිංහල', 'தமிழ்', 'العربية', 'Español'];
const waveform = [8, 14, 10, 16, 7, 12, 18, 9, 13, 6];
const bars = [28, 40, 34, 52, 66, 84];

const features: Feature[] = [
  {
    title: 'Multilingual AI',
    copy: 'Auto-detects your customer’s language and replies in it — 50+ languages out of the box. English, Sinhala, Tamil, Arabic, Spanish and more, with zero setup.',
    span: 'md:col-span-2',
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" {...stroke} />
        <path d="M3.5 12h17M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3Z" {...stroke} />
      </svg>
    ),
    visual: (
      <div className="flex flex-wrap gap-1.5">
        {languages.map((lang) => (
          <span
            key={lang}
            className="rounded-full border border-[#e6e8f5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#12142b]"
          >
            {lang}
          </span>
        ))}
      </div>
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
    visual: (
      <div className="space-y-1.5 text-[12px]">
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-xl rounded-br-sm bg-[#d9fdd3] px-2.5 py-1.5 text-[#12142b]">
            Do you deliver to Kandy?
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="rounded-xl rounded-bl-sm border border-[#e6e8f5] bg-white px-2.5 py-1.5 text-[#12142b]">
            Yes! Delivery in 1–2 days 🚚
          </div>
          <span className="rounded-full bg-gradient-to-r from-teal-brand to-indigo-brand px-1.5 py-0.5 text-[9px] font-semibold text-white">
            &lt;5s
          </span>
        </div>
      </div>
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
    visual: (
      <div className="flex overflow-hidden rounded-xl border border-[#e6e8f5] bg-white">
        <div className="w-1 bg-gradient-to-b from-teal-brand to-indigo-brand" />
        <div className="flex flex-1 items-center justify-between gap-2 px-3 py-2">
          <div>
            <p className="text-[12px] text-[#12142b]">2kg ribbon cake ×1</p>
            <p className="text-[13px] font-bold text-[#12142b]">LKR 6,500</p>
          </div>
          <span className="whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
            ✅ Confirmed
          </span>
        </div>
      </div>
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
    visual: (
      <div className="flex items-center gap-2">
        <span className="rounded-lg border border-[#e6e8f5] bg-white px-2 py-1.5 text-[11px] font-semibold text-[#12142b]">
          AI
        </span>
        <span className="text-gradient text-base font-bold">→</span>
        <div className="flex-1 rounded-xl border border-[#e6e8f5] bg-white px-2.5 py-1.5">
          <p className="text-[11px] font-semibold text-[#12142b]">Team inbox</p>
          <p className="text-[9px] text-[#5a5e7a]">Summary attached</p>
          <div className="mt-1 flex gap-1">
            <span className="rounded-full bg-rose-50 px-1.5 py-px text-[9px] font-medium text-rose-600">
              urgent
            </span>
            <span className="rounded-full bg-indigo-50 px-1.5 py-px text-[9px] font-medium text-indigo-600">
              billing
            </span>
          </div>
        </div>
      </div>
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
    visual: (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-xl rounded-bl-sm bg-[#d9fdd3] px-2.5 py-2">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1.5 1.2v7.6L8.8 5 1.5 1.2Z" fill="#12142b" />
          </svg>
          <div className="flex items-end gap-[2px]">
            {waveform.map((h, i) => (
              <span key={i} style={{ height: h }} className="w-[2px] rounded-full bg-[#12142b]/60" />
            ))}
          </div>
          <span className="text-[10px] text-[#5a5e7a]">0:12</span>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-teal-brand/20 to-indigo-brand/25 text-base">
          🖼️
        </div>
      </div>
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
    visual: (
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex h-14 items-end gap-1.5">
            {bars.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className="flex-1 rounded-t-sm bg-gradient-to-t from-teal-brand to-indigo-brand"
              />
            ))}
          </div>
          <div className="mt-1 h-px bg-[#e6e8f5]" />
        </div>
        <span className="whitespace-nowrap rounded-full border border-[#e6e8f5] bg-white px-2 py-1 text-[11px] font-semibold text-[#12142b]">
          4.8 <span className="text-amber-500">★</span> CSAT
        </span>
      </div>
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
            Meet the employee who never sleeps. <span className="text-gradient">Never misses a customer.</span>
          </h2>
          <p className="mt-4 text-lg text-[#5a5e7a]">
            Available 24/7 to answer questions, close sales, schedule bookings, and support your
            customers all on WhatsApp.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 0.08} className={f.span}>
              <div className="group h-full rounded-2xl bg-gradient-to-br from-teal-brand/25 to-indigo-brand/25 p-px transition-all duration-300 hover:-translate-y-1 hover:from-teal-brand hover:to-indigo-brand hover:shadow-[0_16px_40px_rgba(74,66,252,0.14)]">
                <div
                  className="glass relative h-full overflow-hidden rounded-[15px] p-7"
                >
                  <div
                    aria-hidden
                    className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-indigo-brand/0 blur-3xl transition-all duration-500 group-hover:bg-indigo-brand/10"
                  />
                  <span
                    aria-hidden
                    className="absolute right-5 top-5 -translate-x-1 translate-y-1 text-lg font-semibold text-indigo-brand opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
                  >
                    →
                  </span>
                  <div className="glass flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 group-hover:border-transparent group-hover:bg-gradient-to-br group-hover:from-teal-brand group-hover:to-indigo-brand">
                    <span className="transition-all duration-300 group-hover:[filter:brightness(0)_invert(1)]">
                      {f.icon}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#12142b]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5a5e7a]">{f.copy}</p>
                  <div className="mt-5">{f.visual}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
