import Reveal from './Reveal';

const chips = ['24/7 replies', '50+ languages', '<5s response', 'No-code setup'];

export default function TrustStrip() {
  return (
    <section className="border-y border-white/[0.06] py-10">
      <Reveal className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-5">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Built for businesses that live on WhatsApp
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {chips.map((c) => (
            <span
              key={c}
              className="glass rounded-full px-4 py-2 text-sm font-medium text-slate-300"
            >
              {c}
            </span>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
