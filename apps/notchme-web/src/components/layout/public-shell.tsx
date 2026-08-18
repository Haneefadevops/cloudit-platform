import { MarketingHeader } from "./marketing-header";

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
      <main id="main-content" className="flex-1">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} NotchMe. Every introduction deserves a next step.
        </div>
      </footer>
    </div>
  );
}
