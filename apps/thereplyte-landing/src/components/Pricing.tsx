'use client';

import { useEffect, useState } from 'react';
import Reveal from './Reveal';
import { WA_LINK } from './Logo';

type Currency = 'USD' | 'LKR';

type Plan = {
  name: string;
  price: Record<Currency, string>;
  period?: string;
  blurb: string;
  bullets: string[];
  popular?: boolean;
};

const plans: Plan[] = [
  {
    name: 'Starter',
    price: { USD: '$12', LKR: 'LKR 3,500' },
    period: '/mo',
    blurb: 'For small teams getting their first AI employee.',
    bullets: [
      '1 WhatsApp number',
      '500 AI conversations / month included',
      'AI replies 24/7 — 50+ languages',
      'Knowledge base (website crawl + docs)',
      'Welcome & fallback messages, operating hours',
      'Human handoff to team inbox',
      'Email support',
    ],
  },
  {
    name: 'Business',
    price: { USD: '$25', LKR: 'LKR 7,500' },
    period: '/mo',
    blurb: 'For businesses that sell and book on WhatsApp daily.',
    bullets: [
      'Everything in Starter',
      '1,500 AI conversations / month included',
      'Orders & bookings — calendar + order book',
      'Voice notes, images & bank-slip reading',
      'Smart handoff with AI summary & labels',
      'Canned responses for agents',
      'CSAT, analytics & AI cost tracking',
      'Multiple team agents',
      'Priority support',
    ],
    popular: true,
  },
  {
    name: 'Enterprise',
    price: { USD: 'Custom', LKR: 'Custom' },
    blurb: 'For multi-team and multi-brand operations.',
    bullets: [
      'Everything in Business',
      'Multiple numbers & brands',
      'Custom conversation volumes',
      'Broadcast campaigns',
      'Custom integrations & API access',
      'Dedicated success manager & SLA',
    ],
  },
];

const overage: Record<Currency, string> = {
  USD: '$0.02',
  LKR: 'LKR 5',
};
const extraNumber: Record<Currency, string> = {
  USD: '$5/mo',
  LKR: 'LKR 1,500/mo',
};

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
  const [currency, setCurrency] = useState<Currency>('USD');

  useEffect(() => {
    try {
      if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Colombo') {
        setCurrency('LKR');
      }
    } catch {
      // keep USD default
    }
  }, []);

  return (
    <section id="pricing" className="relative border-t border-[#e6e8f5] bg-[#f6f7fd] py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-brand">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#12142b] sm:text-4xl lg:text-5xl">
            Cheaper than <span className="text-gradient">one day</span> of a human hire
          </h2>
          <p className="mt-4 text-lg text-[#5a5e7a]">
            Simple monthly plans. Fair usage included. Cancel anytime.
          </p>
          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-[#e6e8f5] bg-white p-1">
            {(['USD', 'LKR'] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
                  currency === c
                    ? 'bg-gradient-to-r from-teal-brand to-indigo-brand text-white'
                    : 'text-[#5a5e7a] hover:text-[#12142b]'
                }`}
              >
                {c === 'USD' ? '$ USD' : 'Rs LKR'}
              </button>
            ))}
          </div>
        </Reveal>

        <div className="mt-14 grid items-stretch gap-6 md:grid-cols-3">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 0.1} className="h-full">
              {p.popular ? (
                <div className="relative h-full rounded-2xl bg-brand-gradient p-px shadow-[0_20px_48px_-12px_rgba(74,66,252,0.35)]">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-gradient px-3.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                  <PlanCard plan={p} currency={currency} />
                </div>
              ) : (
                <PlanCard plan={p} currency={currency} />
              )}
            </Reveal>
          ))}
        </div>

        <Reveal className="mx-auto mt-10 max-w-3xl text-center">
          <p className="text-xs leading-relaxed text-[#5a5e7a]">
            Extra usage: {overage[currency]} per conversation beyond your plan. Extra WhatsApp
            number: {extraNumber[currency]}. Spending caps &amp; alerts included — no surprise
            bills. Sri Lankan customers are billed in LKR; international customers in USD.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function PlanCard({ plan, currency }: { plan: Plan; currency: Currency }) {
  const price = plan.price[currency];
  return (
    <div
      className={`flex h-full flex-col rounded-2xl p-8 ${
        plan.popular ? 'rounded-[calc(1rem-1px)] bg-white' : 'glass'
      }`}
    >
      <h3 className="text-lg font-semibold text-[#12142b]">{plan.name}</h3>
      <div className="mt-4 flex items-baseline gap-1">
        <span className={`text-4xl font-extrabold tracking-tight ${plan.popular ? 'text-gradient' : 'text-[#12142b]'}`}>
          {price}
        </span>
        {plan.period && <span className="text-sm text-[#5a5e7a]">{plan.period}</span>}
      </div>
      <p className="mt-3 text-sm text-[#5a5e7a]">{plan.blurb}</p>
      <ul className="mt-7 flex flex-1 flex-col gap-3">
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-[#5a5e7a]">
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
            ? 'btn-gradient text-white'
            : 'glass text-[#12142b] hover:border-indigo-brand/30'
        }`}
      >
        {price === 'Custom' ? 'Talk to us' : 'Get started'}
      </a>
    </div>
  );
}
