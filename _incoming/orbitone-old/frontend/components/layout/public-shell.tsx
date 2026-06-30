"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeIconButton } from "@/components/theme-toggle";

export function PublicShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const auth = useAuth();

  return (
    <div className="flex min-h-full flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <Link href="/" className="shrink-0">
            <Logo />
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <LanguageSwitcher compact />
            </div>
            <ThemeIconButton />
            {auth.status === "authenticated" ? (
              <Link href="/dashboard">
                <Button variant="outline" size="sm">
                  Dashboard
                </Button>
              </Link>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main
        className={[
          "flex-1 px-4 py-6 sm:px-6 sm:py-10",
          className,
        ].join(" ")}
      >
        {children}
      </main>

      <footer className="border-t border-border bg-surface px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 text-center">
          <p className="text-xs font-medium text-secondary">
            Made for Sri Lankan professionals
          </p>
          <p className="text-sm text-muted">
            Powered by{" "}
            <span className="font-semibold text-foreground">OrbitOne</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
