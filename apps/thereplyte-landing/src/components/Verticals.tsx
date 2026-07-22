import Reveal from './Reveal';

const verticals = [
  { name: 'Clinics', use: 'Books appointments and answers patient questions after hours.' },
  { name: 'Salons & Spas', use: 'Fills your calendar while you’re with a client.' },
  { name: 'Online Shops', use: 'Answers “price?”, takes orders and tracks deliveries in chat.' },
  { name: 'Restaurants', use: 'Takes table bookings and menu questions during the rush.' },
  { name: 'Education', use: 'Handles enrolment questions and course details, day and night.' },
  { name: 'Real Estate', use: 'Qualifies leads and schedules viewings before competitors reply.' },
];

export default function Verticals() {
  return (
    <section className="border-t border-[#e6e8f5] py-24 md:py-28">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-[#12142b] sm:text-4xl">
            One AI, <span className="text-gradient">every business</span>
          </h2>
          <p className="mt-4 text-lg text-[#5a5e7a]">
            If your customers message you on WhatsApp, TheReplyte can answer them.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {verticals.map((v, i) => (
            <Reveal key={v.name} delay={(i % 3) * 0.08}>
              <div className="glass group h-full rounded-2xl px-6 py-5 transition-all duration-300 hover:border-teal-brand/40 hover:shadow-[0_12px_32px_-10px_rgba(0,216,199,0.35)]">
                <div className="flex items-center gap-2.5">
                  <span className="h-2 w-2 rounded-full bg-brand-gradient" />
                  <h3 className="font-semibold text-[#12142b]">{v.name}</h3>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#5a5e7a]">{v.use}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
