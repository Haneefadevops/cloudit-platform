import Logo, { WA_LINK } from './Logo';

export default function Footer() {
  return (
    <footer className="bg-[#f6f7fd]">
      <div aria-hidden className="h-[2px] bg-gradient-to-r from-teal-brand to-indigo-brand" />
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-8 px-5 py-12 md:flex-row">
        <Logo size={28} />
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#5a5e7a]">
          <a href="#features" className="transition-colors hover:text-[#12142b]">Features</a>
          <a href="#how" className="transition-colors hover:text-[#12142b]">How it works</a>
          <a href="#pricing" className="transition-colors hover:text-[#12142b]">Pricing</a>
          <a
            href={WA_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-[#12142b]"
          >
            WhatsApp
          </a>
          <a href="mailto:hello@thereplyte.com" className="transition-colors hover:text-[#12142b]">
            hello@thereplyte.com
          </a>
        </nav>
        <p className="text-sm text-[#5a5e7a]">© 2026 TheReplyte by CloudIT</p>
      </div>
    </footer>
  );
}
