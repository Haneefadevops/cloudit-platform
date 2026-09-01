'use client';

import { useState } from 'react';
import Reveal from './Reveal';

export default function FinalCTA() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="relative bg-sand-50 py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gold-500">
                Begin your journey
              </p>
              <h2 className="heading-md mt-4 text-navy-900">
                Start your <span className="text-gradient">escape today</span>
              </h2>
              <p className="mt-6 max-w-md text-lg leading-relaxed text-navy-800">
                Tell us where you want to go and our travel designers will reply with a tailored itinerary within 24 hours.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  'No commitment required',
                  'Tailored to your budget and style',
                  'Response within 24 hours',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 text-navy-800">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-500">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="rounded-3xl border border-sand-200 bg-white p-8 shadow-soft md:p-10">
              {submitted ? (
                <div className="rounded-2xl border border-gold-400/20 bg-gold-400/5 p-8 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-gold-400/30 bg-white text-gold-500">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                  <h3 className="mt-5 font-serif text-2xl text-navy-900">Request received</h3>
                  <p className="mt-2 text-navy-800">
                    Thank you for reaching out. A WanderLuxe designer will contact you shortly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-navy-800">
                        Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        required
                        className="w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-navy-900 outline-none transition-all focus:border-gold-400 focus:bg-white"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-navy-800">
                        Email
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        className="w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-navy-900 outline-none transition-all focus:border-gold-400 focus:bg-white"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-navy-800">
                      Phone
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-navy-900 outline-none transition-all focus:border-gold-400 focus:bg-white"
                      placeholder="+1 555 123 4567"
                    />
                  </div>
                  <div>
                    <label htmlFor="message" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-navy-800">
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={4}
                      required
                      className="w-full rounded-xl border border-sand-200 bg-sand-50 px-4 py-3 text-navy-900 outline-none transition-all focus:border-gold-400 focus:bg-white"
                      placeholder="Tell us about your dream trip..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-gradient w-full rounded-full py-4 text-sm font-semibold tracking-wide text-navy-950 transition-transform hover:scale-[1.02]"
                  >
                    Request a bespoke itinerary
                  </button>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
