export default function Footer() {
  return (
    <footer className="bg-navy-950">
      <div aria-hidden className="h-[1px] bg-gradient-to-r from-transparent via-gold-400/50 to-transparent" />
      <div className="mx-auto max-w-7xl px-5 py-14">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          <a href="#" aria-label="WanderLuxe home" className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" className="text-gold-400" aria-hidden="true">
              <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 28c0-8 4-14 8-16s8 8 8 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="20" cy="14" r="2.5" fill="currentColor" />
            </svg>
            <span className="font-serif text-2xl text-white">WanderLuxe</span>
          </a>
          <nav className="flex flex-wrap items-center justify-center gap-8 text-sm text-white/60">
            <a href="#destinations" className="transition-colors hover:text-gold-300">Destinations</a>
            <a href="#configurator" className="transition-colors hover:text-gold-300">Configurator</a>
            <a href="#testimonials" className="transition-colors hover:text-gold-300">Testimonials</a>
            <a href="#contact" className="transition-colors hover:text-gold-300">Contact</a>
          </nav>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/40 md:flex-row">
          <p>
            © 2026 WanderLuxe by{' '}
            <a
              href="https://www.cloudit.lk"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-white"
            >
              CloudIT
            </a>
          </p>
          <a href="mailto:hello@wanderluxe.cloudit.lk" className="transition-colors hover:text-white">
            hello@wanderluxe.cloudit.lk
          </a>
        </div>
      </div>
    </footer>
  );
}
