import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ThemeIconButton } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="focus:outline-none">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          <ThemeIconButton />
          <Link
            href="/login"
            className="hidden text-sm font-medium text-foreground hover:text-secondary sm:block"
          >
            Log in
          </Link>
          <Link href="/login?mode=register">
            <Button size="sm" className="hidden sm:inline-flex">
              Get started free
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
