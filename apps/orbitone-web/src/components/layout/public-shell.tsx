import { MarketingHeader } from "./marketing-header";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} OrbitOne. Turn every introduction into
          an opportunity.
        </div>
      </footer>
    </div>
  );
}
