import Reveal from '@/components/Reveal';

const steps = [
  {
    title: 'Customer scans QR or uses your service link',
    text: 'No app to install. The customer scans the QR tag on the asset or opens your service link and reports the issue in seconds.',
  },
  {
    title: 'AI creates a triaged job with full asset history',
    text: 'FixifAI asks the right follow-up questions, then files a triaged job with the complete service history of that asset attached.',
  },
  {
    title: 'Technician completes it on the mobile app',
    text: 'GPS-verified check-in, checklist, photos, customer signature and every visit is documented end to end.',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f0fafa]">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
        <Reveal>
          <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-brand-dark sm:text-4xl">
            How it works
          </h2>
        </Reveal>
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          {/* connecting line on desktop */}
          <div
            aria-hidden
            className="absolute left-[16%] right-[16%] top-8 hidden border-t-2 border-dashed border-brand-teal/30 md:block"
          />
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1}>
              <div className="relative h-full rounded-2xl border border-brand-teal/15 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-brand-teal/10">
                <div className="relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-teal font-heading text-xl font-bold text-white shadow-lg shadow-brand-teal/30">
                  {i + 1}
                </div>
                <h3 className="font-heading text-lg font-semibold leading-snug text-gray-900">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
