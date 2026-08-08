import Reveal from '@/components/Reveal';
import Counter from '@/components/Counter';
import DashboardMockup from '@/components/DashboardMockup';
import Marquee from '@/components/Marquee';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-dark via-[#015757] to-brand-teal">
      {/* soft glow accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-10%] h-96 w-96 rounded-full bg-brand-teal/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-24 left-[-8%] h-80 w-80 rounded-full bg-brand-orange/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:pb-28">
        {/* copy */}
        <Reveal>
          <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.6rem]">
            The <span className="text-brand-orange">AI</span> powered{' '}
            <span className="text-brand-orange">Operating System</span> for maintenance
            businesses.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/80">
            Automate job intake, dispatch technicians, track assets, and manage every
            work order from a single dashboard.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href="#signup"
              className="btn-glow rounded-xl px-7 py-3.5 text-center font-semibold text-white"
            >
              Join the Free Pilot
            </a>
            <a
              href="#demo"
              className="btn-ghost-dark rounded-xl px-7 py-3.5 text-center font-semibold"
            >
              See it in action
            </a>
          </div>
          <p className="mt-6 text-sm text-white/60">
            Free for 3 months · No card required · 50% off Year 1 for founding customers
          </p>

          {/* illustrative stats with count-up on scroll into view */}
          <div className="mt-10 flex flex-wrap gap-x-10 gap-y-5 border-t border-white/10 pt-7">
            <div>
              <p className="font-heading text-2xl font-bold text-white">
                <Counter to={1200} suffix="+" />
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-white/55">Jobs completed</p>
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-white">
                <Counter to={99.9} decimals={1} suffix="%" />
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-white/55">Uptime</p>
            </div>
            <div>
              <p className="font-heading text-2xl font-bold text-white">
                <Counter to={5} prefix="<" suffix=" min" />
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-white/55">Response</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-white/40">Illustrative figures from the demo environment</p>
        </Reveal>

        {/* tilted 3D dashboard mockup */}
        <Reveal delay={0.15} className="lg:pl-4">
          <DashboardMockup />
        </Reveal>
      </div>

      {/* trades marquee bridging hero into the white section */}
      <Marquee />
    </section>
  );
}
