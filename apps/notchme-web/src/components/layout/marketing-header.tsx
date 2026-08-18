import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-11 items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-semibold text-foreground">NotchMe</span>
        </Link>

        <nav aria-label="Marketing navigation" className="hidden items-center gap-5 text-sm font-medium md:flex">
          <a href="#workflow" className="inline-flex min-h-11 items-center text-muted transition-colors hover:text-foreground">
            Workflow
          </a>
          <a href="#capabilities" className="inline-flex min-h-11 items-center text-muted transition-colors hover:text-foreground">Capabilities</a>
          <a href="#pricing" className="inline-flex min-h-11 items-center text-muted transition-colors hover:text-foreground">
            Pricing
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-11 px-4" asChild>
            <Link href="/login">Log in</Link>
          </Button>
          <Button
            size="sm"
            className="h-11 px-4"
            asChild
          >
            <Link href="/register">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
