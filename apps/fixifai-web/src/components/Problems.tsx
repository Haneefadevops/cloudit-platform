import Reveal from '@/components/Reveal';

function Icon({ d }: { d: string }) {
  return (
    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-orange/10 text-brand-orange">
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={d} />
      </svg>
    </span>
  );
}

const problems = [
  {
    problem: 'Still managing jobs through WhatsApp?',
    answer: 'Every message becomes a tracked work order.',
    icon: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  },
  {
    problem: 'Did your technician really visit?',
    answer: 'GPS check-ins and photos prove every job.',
    icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  },
  {
    problem: 'Still invoicing days later?',
    answer: 'Generate invoices the moment a job is finished.',
    icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  },
  {
    problem: 'Missing AMC renewals?',
    answer: 'Automatic reminders keep contracts on track.',
    icon: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9 M13.7 21a2 2 0 0 1-3.4 0',
  },
  {
    problem: 'No one remembers the service history',
    answer: 'Scan a QR code to see every service visit.',
    icon: 'M3 3h6v6H3z M15 3h6v6h-6z M3 15h6v6H3z M15 15h3v3h-3z M21 15v.01 M18 21h3 M21 18v3',
  },
  {
    problem: 'Still sending quotes hours later?',
    answer: 'Create quotes on-site and get instant customer approval.',
    icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  },
];

export default function Problems() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
            Your business deserves a{' '}
            <span className="text-brand-orange">Better Way</span>.
          </h2>
        </Reveal>
        {/* bento grid: two wide tiles up top, four standard below on desktop */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((p, i) => (
            <Reveal
              key={p.problem}
              delay={i * 0.06}
              className={i < 2 ? 'lg:col-span-2' : ''}
            >
              <div className="group h-full rounded-2xl border border-gray-200/80 bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-teal/30 hover:shadow-xl hover:shadow-brand-teal/10">
                <Icon d={p.icon} />
                <h3 className="mt-5 font-heading text-lg font-semibold leading-snug text-gray-900">
                  {p.problem}
                </h3>
                <p className="mt-3 flex items-start gap-2 text-sm font-medium text-brand-teal">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-teal/10 text-[10px] font-bold">
                    ✓
                  </span>
                  {p.answer}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
