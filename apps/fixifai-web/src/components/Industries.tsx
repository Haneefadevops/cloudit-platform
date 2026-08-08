import Reveal from '@/components/Reveal';

const industries = [
  'AC & Refrigeration',
  'Lifts & Elevators',
  'Generators & Power',
  'Fire & Security',
  'Facilities Management',
  'CCTV & Electronics',
];

export default function Industries() {
  return (
    <section id="industries">
      <div className="mx-auto max-w-6xl px-4 pt-20 sm:px-6 sm:pt-24">
        <Reveal>
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Run your maintenance business.{' '}
            <span className="text-brand-orange">Let FixifAI handle the operations</span>
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((name, i) => (
            <Reveal key={name} delay={i * 0.06}>
              <div className="group flex h-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-teal/50 hover:bg-white/10">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/25 text-brand-teal transition-colors group-hover:bg-brand-teal group-hover:text-white">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                  </svg>
                </span>
                <h3 className="font-heading font-semibold text-white">{name}</h3>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-white/60">
          Your trade not listed? FixifAI adapts custom asset types and checklists.
        </p>
      </div>
    </section>
  );
}
