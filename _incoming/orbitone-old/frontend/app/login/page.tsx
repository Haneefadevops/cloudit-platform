"use client";

import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "./auth-form";
import { Logo } from "@/components/brand/logo";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/i18n-provider";
import { QrCode, Users, Share2, BarChart3 } from "lucide-react";

function LoginPageContent() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Left panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-primary p-12 text-white lg:flex lg:w-1/2">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-secondary/30 via-transparent to-transparent" />
        <div className="absolute inset-0 -z-20 gradient-sunset opacity-20" />
        <div className="absolute bottom-0 right-0 -z-10 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />

        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex">
            <Logo className="!text-white" />
          </Link>
          <LanguageSwitcher compact />
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-bold tracking-tight">
            {t("networkTagline")}
          </h2>
          <p className="mt-4 text-white/80">{t("networkDescription")}</p>

          <ul className="mt-8 space-y-4">
            <Benefit icon={<QrCode className="h-5 w-5" />} text={t("benefitQR")} />
            <Benefit icon={<Users className="h-5 w-5" />} text={t("benefitNetwork")} />
            <Benefit icon={<Share2 className="h-5 w-5" />} text={t("benefitVCard")} />
            <Benefit icon={<BarChart3 className="h-5 w-5" />} text={t("benefitAnalytics")} />
          </ul>
        </div>

        <p className="text-sm text-white/60">
          {t("footerCopy").replace("{year}", String(new Date().getFullYear()))}
        </p>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col justify-center bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" className="inline-flex">
              <Logo />
            </Link>
            <LanguageSwitcher compact />
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {t("welcomeBack")}
            </h1>
            <p className="mt-2 text-sm text-muted">{t("signInSubtitle")}</p>
          </div>

          <Suspense fallback={null}>
            <AuthForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}

function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3 text-sm font-medium text-white/90">
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
        {icon}
      </span>
      {text}
    </li>
  );
}
