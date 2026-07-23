import Reveal from './Reveal';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'url(#trust-grad)',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const stats = [
  {
    value: '24/7',
    label: 'Always-on replies',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    value: '50+',
    label: 'Languages spoken',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
    ),
  },
  {
    value: '<5s',
    label: 'Avg. first response',
    icon: (
      <svg {...iconProps}>
        <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" />
      </svg>
    ),
  },
  {
    value: '100%',
    label: 'No-code setup',
    icon: (
      <svg {...iconProps}>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z" />
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" />
      </svg>
    ),
  },
  {
    value: 'Same-day',
    label: 'Signup to launch',
    icon: (
      <svg {...iconProps}>
        <path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2c.8-.8.8-2 0-2.8-.8-.8-2-.8-2.8 0Z" />
        <path d="M9 13c2-5 6-9 11-10-1 5-5 9-10 11" />
        <path d="M14 6h4v4" />
      </svg>
    ),
  },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-[#e6e8f5] bg-[#f6f7fd] py-14">
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="trust-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#00d8c7" />
            <stop offset="1" stopColor="#4a42fc" />
          </linearGradient>
        </defs>
      </svg>
      <Reveal className="mx-auto flex max-w-6xl flex-col items-center gap-9 px-5">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gradient">
          Built for businesses that live on WhatsApp
        </p>
        <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass flex flex-col items-center gap-3 rounded-2xl px-4 py-6 text-center transition-shadow hover:shadow-[0_12px_36px_rgba(74,66,252,0.12)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e6e8f5] bg-white">
                {s.icon}
              </span>
              <span className="text-2xl font-extrabold tracking-tight text-[#12142b]">
                {s.value}
              </span>
              <span className="text-sm text-[#5a5e7a]">{s.label}</span>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
