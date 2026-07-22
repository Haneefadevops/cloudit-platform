import Reveal from './Reveal';
import { WA_LINK } from './Logo';

type Plan = {
  name: string;
  price: string;
  period?: string;
  blurb: string;
  bullets: string[];
  popular?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Starter',
    price: 'LKR 3,500',
    period: '/mo',
    blurb: 'For small teams getting their first AI employee.',
    bullets: [
      '1 WhatsApp number',
      'AI replies, 24/7',
      'Knowledge base (website crawl + docs)',
      'Multilingual replies — 50+ languages',
      'Email support',
    ],
  },
  {
    name: 'Business',
    price: 'LKR 7,500',
    period: '/mo',
    blurb: 'For businesses that sell and book on WhatsApp daily.',
    bullets: [
      'Everything in Starter',
      'Team inbox & smart human handoff',
      'Orders & bookings in chat',
      'Voice notes & image understanding',
      'Analytics, CSAT & AI cost tracking',
      'Priority support',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    blurb: 'For multi-team and multi-brand operations.',
    bullets: [
      'Everything in Business',
      'Multiple numbers & teams',
      'Custom integrations & API access',
      'Dedicated success manager',
      'SLA & guided onboarding',
    ],
  },
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="mt-0.5 shrink-0">
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="url(#icon-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="relative border-t border-white/[0.06] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-brand">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Cheaper than <span className="text-gradient">one day</span> of a human hire
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Simple monthly plans. Cancel anytime.
          </p>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.1} className="h-full">
              {p.popular ? (
                <div className="relative h-full rounded-2xl bg-brand-gradient p-px shadow-[0_0_48px_-12px_rgba(74,66,252,0.55)]">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-night">
                    Most popular
                  </span>
                  <PlanCard plan={p} />
                </div>
              ) : (
                <PlanCard plan={p} />
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`flex h-full flex-col rounded-2xl p-8 ${
        plan.popular ? 'rounded-[calc(1rem-1px)] bg-[#0d0d18]' : 'glass'
      }`}
    >
      <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className={`text-4xl font-extrabold tracking-tight ${plan.popular ? 'text-gradient' : 'text-white'}`}>
          {plan.price}
        </span>
        {plan.period && <span className="text-sm text-slate-500">{plan.period}</span>}
      </div>
      <p className="mt-3 text-sm text-slate-400">{plan.blurb}</p>
      <ul className="mt-7 flex flex-1 flex-col gap-3">
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-slate-300">
            <Check />
            {b}
          </li>
        ))}
      </ul>
      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        className={`mt-8 rounded-full px-6 py-3 text-center text-sm font-semibold transition-all ${
          plan.popular
            ? 'btn-gradient text-night'
            : 'glass text-slate-200 hover:border-white/20 hover:text-white'
        }`}
      >
        {plan.price === 'Custom' ? 'Talk to us' : 'Get started'}
      </a>
    </div>
  );
}
