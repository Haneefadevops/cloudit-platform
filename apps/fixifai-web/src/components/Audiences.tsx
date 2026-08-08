import Reveal from '@/components/Reveal';

const audiences = [
  {
    title: 'For Service Companies',
    points: ['Quotations', 'Invoices', 'Branded client portal'],
    text: 'Win jobs faster with on-site quotations, get paid on time with invoices issued on completion, and give your clients a branded portal to request and track work.',
  },
  {
    title: 'For In-House Teams',
    points: ['Downtime tracking', 'PM schedules', 'Cost per asset'],
    text: 'Keep your facility running with downtime tracking, preventive maintenance schedules, and a clear view of what every asset costs you.',
  },
];

export default function Audiences() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <div className="grid gap-6 md:grid-cols-2">
          {audiences.map((a, i) => (
            <Reveal key={a.title} delay={i * 0.1}>
              <div className="flex h-full flex-col rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-[#f7fcfc] p-9 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-teal/30 hover:shadow-xl hover:shadow-brand-teal/10">
                <h3 className="font-heading text-xl font-bold text-brand-dark">{a.title}</h3>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {a.points.map((pt) => (
                    <li
                      key={pt}
                      className="flex items-center gap-2 rounded-full bg-brand-teal/10 px-3.5 py-1.5 text-sm font-medium text-brand-dark"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-orange" />
                      {pt}
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm leading-relaxed text-gray-600">{a.text}</p>
                <a
                  href="#signup"
                  className="mt-7 inline-block w-fit rounded-xl bg-brand-teal px-6 py-3 text-sm font-semibold text-white shadow-md shadow-brand-teal/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-teal/30"
                >
                  Join the Free Pilot
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
