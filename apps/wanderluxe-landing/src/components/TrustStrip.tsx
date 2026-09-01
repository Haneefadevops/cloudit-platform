import Reveal from './Reveal';

const iconProps = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const stats = [
  {
    value: '12,000+',
    label: 'Happy travelers',
    icon: (
      <svg {...iconProps}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    value: '500+',
    label: 'Curated trips',
    icon: (
      <svg {...iconProps}>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
        <path d="M3.27 6.96 12 12.01l8.73-5.05" />
        <path d="M12 22.08V12" />
      </svg>
    ),
  },
  {
    value: '4.9/5',
    label: 'Average rating',
    icon: (
      <svg {...iconProps}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
  {
    value: '24/7',
    label: 'Concierge support',
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    value: '100%',
    label: 'Customizable',
    icon: (
      <svg {...iconProps}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

export default function TrustStrip() {
  return (
    <section className="border-y border-sand-200 bg-sand-50 py-16 md:py-20">
      <div className="mx-auto max-w-7xl px-5">
        <Reveal className="flex flex-col items-center gap-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">
              Trusted by luxury travelers worldwide
            </p>
            <div className="divider-gold mt-4" />
          </div>
          <div className="grid w-full gap-px overflow-hidden rounded-3xl bg-sand-200 sm:grid-cols-3 lg:grid-cols-5">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`group flex flex-col items-center gap-4 bg-sand-50 px-6 py-10 text-center transition-colors hover:bg-white ${
                  i === stats.length - 1 ? 'sm:col-span-3 lg:col-span-1' : ''
                }`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-sand-200 bg-white text-gold-500 shadow-soft transition-transform group-hover:-translate-y-1">
                  {s.icon}
                </span>
                <div>
                  <span className="block text-3xl font-serif font-medium tracking-tight text-navy-900">
                    {s.value}
                  </span>
                  <span className="mt-1 block text-sm text-navy-800">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
