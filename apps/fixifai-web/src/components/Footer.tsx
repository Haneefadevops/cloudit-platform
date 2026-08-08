import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="bg-brand-dark text-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row">
          <div>
            {/* FixifAI logo stays on a white badge per brand visibility rule */}
            <div className="inline-block rounded-lg bg-white px-3 py-2 shadow-md">
              <Image src="/brand/Fixif.svg" alt="FixifAI" width={92} height={27} />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              Run your maintenance business from one screen. QR-tagged assets, AI job
              intake, GPS-verified technicians.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
              Contact
            </h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="https://chat.cloudit.lk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 transition-colors hover:text-brand-orange"
                >
                  WhatsApp: chat.cloudit.lk
                </a>
              </li>
              <li>
                <a
                  href="mailto:info@cloudit.lk"
                  className="text-white/80 transition-colors hover:text-brand-orange"
                >
                  info@cloudit.lk
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/80">
              Built by
            </h3>
            <div className="mt-3">
              {/* PNG: the SVG's text isn't outlined, so browsers render it in a fallback font */}
              <Image src="/brand/logo-white.png" alt="CloudIT" width={96} height={69} />
            </div>
            <p className="mt-2 text-sm text-white/70">CloudIT (Pvt) Ltd</p>
          </div>
        </div>
        <div className="mt-8 border-t border-white/10 pt-5 text-sm text-white/60">
          © 2026 FixifAI — built by CloudIT (Pvt) Ltd
        </div>
      </div>
    </footer>
  );
}
