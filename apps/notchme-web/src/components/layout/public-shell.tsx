import { MarketingHeader } from "./marketing-header";
import Link from "next/link";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only z-[60] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to main content
      </a>
      <MarketingHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted sm:px-6 md:flex-row lg:px-8">
          <span>
            &copy; {new Date().getFullYear()} NotchMe. Every introduction
            deserves a next step.
          </span>
          <nav
            aria-label="Legal and trust"
            className="flex flex-wrap justify-center gap-x-4 gap-y-2"
          >
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookies">Cookies</Link>
            <Link href="/security">Security</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
