'use client';

import { useState } from 'react';
import Reveal from '@/components/Reveal';

const faqs = [
  {
    q: 'Is it really free for 3 months?',
    a: "Yes. The pilot is genuinely free for 3 months and we don't ask for a card. You get the full product while we learn from your feedback.",
  },
  {
    q: 'Do technicians need training?',
    a: 'No. The technician app is simpler than WhatsApp — if your team can use a smartphone, they can use FixifAI from day one.',
  },
  {
    q: 'What happens after the pilot?',
    a: 'Your choice: subscribe to one of the plans (with 50% off Year 1 as a founding customer) or walk away — no lock-in, no cancellation hassle.',
  },
  {
    q: 'Do my customers need to install an app?',
    a: 'No. Customers simply scan the QR tag on the equipment or open your service link in any browser — nothing to install.',
  },
  {
    q: 'Does it work in Sinhala/Tamil?',
    a: 'Not yet — the pilot is English-first. Sinhala and Tamil support is planned for a later phase of the product.',
  },
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-[#f0fafa]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
            Frequently asked questions
          </h2>
        </Reveal>
        <div className="mx-auto mt-14 max-w-3xl space-y-4">
          {faqs.map((f, i) => {
            const open = openIndex === i;
            return (
              <Reveal key={f.q} delay={i * 0.05}>
                <div
                  className={`rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:shadow-md sm:px-7 px-6 ${
                    open ? 'border-brand-teal/30 shadow-md' : 'border-brand-teal/15 hover:border-brand-teal/30'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setOpenIndex(open ? null : i)}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between gap-4 py-6 text-left"
                  >
                    <h3 className="font-heading font-semibold text-gray-900">{f.q}</h3>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      className={`shrink-0 text-brand-teal transition-transform duration-300 ${
                        open ? 'rotate-180' : ''
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="pb-6 text-sm leading-relaxed text-gray-600">{f.a}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
