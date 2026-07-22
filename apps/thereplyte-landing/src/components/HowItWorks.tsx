import Reveal from './Reveal';

const steps = [
  {
    n: '01',
    title: 'Connect your WhatsApp number',
    copy: 'Link your existing business number in minutes. No code, no new hardware, no SIM swaps.',
  },
  {
    n: '02',
    title: 'Teach it your business',
    copy: 'Point it at your website or upload docs, price lists and FAQs. It learns your tone and your answers.',
  },
  {
    n: '03',
    title: 'It answers, sells & hands off',
    copy: 'Replies 24/7 in your customer’s language, takes orders and bookings, and loops in your team when it matters.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="relative border-t border-white/[0.06] py-24 md:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-brand/10 blur-[140px]"
      />
      <div className="relative mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-brand">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Live in <span className="text-gradient">three steps</span>
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-6">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.12}>
              <div className="relative">
                {i < steps.length - 1 && (
                  <div
                    aria-hidden
                    className="absolute left-[calc(50%+3rem)] top-8 hidden h-px w-[calc(100%-6rem)] bg-gradient-to-r from-teal-brand/40 to-indigo-brand/40 md:block"
                  />
                )}
                <div className="flex flex-col items-center text-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-gradient text-lg font-extrabold text-night shadow-[0_0_32px_-6px_rgba(0,216,199,0.5)]">
                    {s.n}
                  </span>
                  <h3 className="mt-6 text-xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">{s.copy}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
