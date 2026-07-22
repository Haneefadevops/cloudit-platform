'use client';

import { useEffect, useState } from 'react';
import Logo, { WA_LINK } from './Logo';

const links = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border py-2.5 pl-5 pr-2.5 transition-all duration-300 ${
          scrolled
            ? 'border-[#e6e8f5] bg-white/85 shadow-[0_8px_32px_rgba(74,66,252,0.10)] backdrop-blur-xl'
            : 'border-white/60 bg-white/60 shadow-[0_4px_24px_rgba(74,66,252,0.06)] backdrop-blur-lg'
        }`}
      >
        <a href="#" aria-label="TheReplyte home" className="flex shrink-0 items-center">
          <Logo size={56} />
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-[#5a5e7a] transition-all hover:bg-[#f0f1fd] hover:text-[#12142b]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gradient hidden rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.03] sm:inline-block"
          >
            Chat with us
          </a>
          <button
            type="button"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#12142b] transition-colors hover:bg-[#f0f1fd] md:hidden"
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
        <div className="mx-auto mt-2 max-w-6xl rounded-3xl border border-[#e6e8f5] bg-white/95 p-3 shadow-[0_16px_48px_rgba(74,66,252,0.12)] backdrop-blur-xl md:hidden">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-2xl px-4 py-3 text-sm font-medium text-[#12142b] transition-colors hover:bg-[#f0f1fd]"
            >
              {l.label}
            </a>
          ))}
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gradient mt-2 block rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white"
          >
            Chat with us
          </a>
        </div>
      )}
    </header>
  );
}
