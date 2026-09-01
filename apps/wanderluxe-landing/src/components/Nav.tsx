'use client';

import { useEffect, useState } from 'react';

const links = [
  { label: 'Destinations', href: '#destinations' },
  { label: 'Configurator', href: '#configurator' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'Contact', href: '#contact' },
];

function LogoMark({ className }: { className?: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <circle cx="20" cy="20" r="19" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 28c0-8 4-14 8-16s8 8 8 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="20" cy="14" r="2.5" fill="currentColor" />
    </svg>
  );
}

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navBase = scrolled
    ? 'border-white/10 bg-white/85 shadow-soft backdrop-blur-xl'
    : 'border-white/15 bg-white/8 backdrop-blur-md';

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-5 sm:px-6">
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border px-5 py-3 transition-all duration-500 ${navBase}`}
      >
        <a href="#" aria-label="WanderLuxe home" className="flex shrink-0 items-center gap-2.5">
          <LogoMark className={`transition-colors duration-500 ${scrolled ? 'text-gold-500' : 'text-gold-300'}`} />
          <span className={`font-serif text-xl font-medium tracking-wide transition-colors duration-500 ${scrolled ? 'text-navy-900' : 'text-white'}`}>
            WanderLuxe
          </span>
        </a>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`relative text-sm font-medium tracking-wide transition-colors after:absolute after:-bottom-1 after:left-0 after:h-[1px] after:w-0 after:bg-current after:transition-all hover:after:w-full ${
                scrolled ? 'text-navy-800 hover:text-navy-900' : 'text-white/80 hover:text-white'
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="#configurator"
            className="btn-gradient hidden rounded-full px-6 py-2.5 text-sm font-semibold tracking-wide text-navy-950 transition-transform hover:scale-[1.03] sm:inline-block"
          >
            Plan My Trip
          </a>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors md:hidden ${
              scrolled ? 'text-navy-900 hover:bg-sand-100' : 'text-white hover:bg-white/10'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </>
              ) : (
                <>
                  <line x1="4" y1="7" x2="20" y2="7" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="17" x2="20" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="mx-auto mt-3 max-w-7xl rounded-3xl border border-white/10 bg-navy-900/95 p-4 shadow-2xl backdrop-blur-xl md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#configurator"
            className="btn-gradient mt-2 block rounded-2xl px-4 py-3 text-center text-sm font-semibold text-navy-950"
          >
            Plan My Trip
          </a>
        </div>
      )}
    </header>
  );
}
