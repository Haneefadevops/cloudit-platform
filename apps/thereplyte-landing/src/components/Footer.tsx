import Logo, { WA_LINK } from './Logo';

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] py-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-5 md:flex-row">
        <Logo size={26} />
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
          <a href="#features" className="transition-colors hover:text-white">Features</a>
          <a href="#how" className="transition-colors hover:text-white">How it works</a>
          <a href="#pricing" className="transition-colors hover:text-white">Pricing</a>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-white"
          >
            WhatsApp
          </a>
          <a href="mailto:hello@thereplyte.com" className="transition-colors hover:text-white">
            hello@thereplyte.com
          </a>
        </nav>
        <p className="text-sm text-slate-500">© 2026 TheReplyte by CloudIT</p>
      </div>
    </footer>
  );
}
