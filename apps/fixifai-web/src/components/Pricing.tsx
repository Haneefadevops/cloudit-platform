import Reveal from '@/components/Reveal';

const tiers = [
  {
    name: 'Essential',
    price: '$15',
    tagline: 'Perfect for small businesses getting started',
    features: [
      'Up to 5 team members',
      'Unlimited jobs & customers',
      'Job scheduling & dispatching',
      'QR-tagged assets & job tracking',
      'Customer portal',
      'Mobile app for technicians',
      'Basic reports',
    ],
  },
  {
    name: 'Professional',
    price: '$45',
    tagline: 'Everything growing maintenance businesses need',
    features: [
      'Everything in Essential',
      'Up to 20 team members',
      'Quotations & invoices',
      'AMC & recurring maintenance',
      'GPS technician check-ins',
      'Before & after job photos',
      'Advanced reporting & analytics',
      'WhatsApp notifications',
    ],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'From $100',
    tagline: 'Built for growing teams and larger operations',
    features: [
      'Everything in Professional',
      'Unlimited team members',
      'Multi-branch management',
      'Branded customer portal',
      'API & integrations',
      'Priority support',
      'Dedicated onboarding',
      'Custom workflows',
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Choose the plan that fits your business
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-white/70">
            Whether you&apos;re a solo technician or managing multiple service teams,
            FixifAI has a plan that grows with your business.
          </p>
          <div className="mx-auto mt-6 w-fit rounded-full border border-brand-orange/40 bg-brand-orange/15 px-5 py-2 text-sm font-semibold text-brand-orange">
            🚀 Founding Customer Offer • Get Your First 3 Months Free
          </div>
          <p className="mt-3 text-center text-xs text-white/50">
            No credit card required • Limited-time offer
          </p>
        </Reveal>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <div
                className={`relative flex h-full flex-col rounded-2xl bg-white p-8 shadow-xl shadow-black/20 transition-all duration-300 hover:-translate-y-1 ${
                  t.highlighted ? 'ring-2 ring-brand-orange' : 'ring-1 ring-white/10'
                }`}
              >
                {t.highlighted && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-orange px-3.5 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md">
                    Most popular
                  </span>
                )}
                <h3 className="font-heading text-lg font-bold text-brand-dark">{t.name}</h3>
                <p className="mt-2 font-heading text-3xl font-bold text-gray-900">
                  {t.price}
                  <span className="font-sans text-base font-normal text-gray-500"> / month</span>
                </p>
                <p className="mt-2 text-sm text-gray-500">{t.tagline}</p>
                <ul className="mb-8 mt-6 space-y-2.5 text-sm text-gray-600">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="mt-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-[10px] font-bold text-brand-teal">
                        ✓
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href="#signup"
                  className={`mt-auto rounded-xl px-5 py-3 text-center text-sm font-semibold transition-all ${
                    t.highlighted
                      ? 'btn-glow text-white'
                      : 'border border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white'
                  }`}
                >
                  Start Free
                </a>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-white/60">
          Optional add-on: WhatsApp/Telegram Automation. AI answers customer messages and
          books jobs for you, on any plan.
        </p>
      </div>
    </section>
  );
}
