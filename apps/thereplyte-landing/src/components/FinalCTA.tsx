import Reveal from './Reveal';
import { WA_LINK } from './Logo';

export default function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-5xl px-5">
        <Reveal>
          <div className="glass relative overflow-hidden rounded-3xl px-8 py-16 text-center md:py-24">
            {/* Glow backdrop */}
            <div aria-hidden className="absolute inset-0">
              <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-teal-brand/20 blur-[110px]" />
              <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-indigo-brand/20 blur-[110px]" />
              <div
                className="absolute inset-0 opacity-60"
                style={{
                  backgroundImage: 'radial-gradient(rgba(18,20,43,0.05) 1px, transparent 1px)',
                  backgroundSize: '26px 26px',
                }}
              />
            </div>

            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-[#12142b] sm:text-4xl lg:text-5xl">
                Experience Your <span className="text-gradient">AI Employee</span> in Action
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg text-[#5a5e7a]">
                Message us on WhatsApp and chat with the same AI that will answer your
                customers no demos, no forms, just a real conversation.
              </p>
              <a
                href={WA_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-gradient mt-9 inline-flex items-center gap-2.5 rounded-full px-8 py-4 text-sm font-semibold text-white"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm5.5 14.2c-.23.65-1.35 1.24-1.87 1.28-.5.05-.97.23-3.28-.68-2.77-1.1-4.53-3.9-4.67-4.08-.14-.18-1.12-1.5-1.12-2.85s.71-2.02.96-2.3c.25-.28.55-.35.73-.35h.53c.17 0 .4-.06.62.48.23.55.78 1.9.85 2.04.07.14.11.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.57.16.28.7 1.16 1.5 1.88 1.04.92 1.9 1.2 2.17 1.34.27.14.43.12.59-.07.16-.19.68-.8.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.14.45.2.52.32.07.11.07.66-.16 1.3Z" />
                </svg>
                Chat with us on WhatsApp
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
