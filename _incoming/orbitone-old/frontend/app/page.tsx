"use client";

import Link from "next/link";
import { MarketingHeader } from "@/components/layout/marketing-header";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n/i18n-provider";
import {
  QrCode,
  Users,
  BarChart3,
  Share2,
  ArrowRight,
  Calendar,
  Briefcase,
  Handshake,
  Sparkles,
} from "lucide-react";

export default function Home() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-full flex-col">
      <MarketingHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 pt-16 pb-28 sm:px-6 sm:pt-24 lg:px-8">
          <div className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-secondary/15 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 -z-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-accent-2/10 blur-3xl" />
          <div className="absolute inset-0 -z-20 gradient-sunset opacity-5" />

          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center rounded-full bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                OrbitOne for Sri Lanka
              </span>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-primary sm:text-5xl lg:text-6xl">
                {t("heroTitle")}
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-muted sm:text-xl lg:mx-0">
                {t("heroSubtitle")}
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/login?mode=register" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full">
                    {t("createCard")}
                  </Button>
                </Link>
                <Link href="/u/demo" className="w-full sm:w-auto">
                  <Button variant="outline" size="lg" className="w-full">
                    {t("demoProfile")}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted">{t("noCreditCard")}</p>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:max-w-none">
              <DemoProfileCard />
              <div className="absolute -bottom-4 -left-4 hidden rounded-2xl border border-border bg-background p-4 shadow-lg sm:block">
                <p className="text-sm font-semibold text-foreground">
                  +128 profile views
                </p>
                <p className="text-xs text-muted">this week</p>
              </div>
            </div>
          </div>
        </section>

        {/* Wave divider */}
        <div className="relative -mt-10 overflow-hidden leading-none">
          <svg
            className="relative block w-full"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              fill="var(--surface)"
              d="M0,32L48,42.7C96,53,192,75,288,74.7C384,75,480,53,576,42.7C672,32,768,32,864,42.7C960,53,1056,75,1152,74.7C1248,75,1344,53,1392,42.7L1440,32L1440,80L1392,80C1344,80,1248,80,1152,80C1056,80,960,80,864,80C768,80,672,80,576,80C480,80,384,80,288,80C192,80,96,80,48,80L0,80Z"
            />
          </svg>
        </div>

        {/* Social proof */}
        <section className="border-y border-border bg-surface px-4 py-10 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted">
            {t("trustedBy")}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-8 opacity-60 grayscale">
            <span className="text-lg font-bold text-foreground">Aitken Spence</span>
            <span className="text-lg font-bold text-foreground">John Keells</span>
            <span className="text-lg font-bold text-foreground">Virtusa</span>
            <span className="text-lg font-bold text-foreground">Cinnamon</span>
          </div>
        </section>

        {/* Features */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                {t("featureTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted">
                {t("featureSubtitle")}
              </p>
            </div>

            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                icon={<QrCode className="h-6 w-6 text-secondary" />}
                title={t("shareQR")}
                description={t("shareQRDesc")}
              />
              <FeatureCard
                icon={<Users className="h-6 w-6 text-secondary" />}
                title={t("growNetwork")}
                description={t("growNetworkDesc")}
              />
              <FeatureCard
                icon={<Share2 className="h-6 w-6 text-secondary" />}
                title={t("saveContact")}
                description={t("saveContactDesc")}
              />
              <FeatureCard
                icon={<BarChart3 className="h-6 w-6 text-secondary" />}
                title={t("trackAnalytics")}
                description={t("trackAnalyticsDesc")}
              />
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section className="bg-surface px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                {t("useCasesTitle")}
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted">
                {t("useCasesSubtitle")}
              </p>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              <UseCaseCard
                icon={<Calendar className="h-6 w-6 text-secondary" />}
                title={t("events")}
                description={t("eventsDesc")}
              />
              <UseCaseCard
                icon={<Briefcase className="h-6 w-6 text-secondary" />}
                title={t("sales")}
                description={t("salesDesc")}
              />
              <UseCaseCard
                icon={<Handshake className="h-6 w-6 text-secondary" />}
                title={t("freelancers")}
                description={t("freelancersDesc")}
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              {t("howItWorks")}
            </h2>
            <div className="mt-16 grid gap-8 sm:grid-cols-3">
              <Step
                number="1"
                title={t("step1")}
                description={t("step1Desc")}
              />
              <Step
                number="2"
                title={t("step2")}
                description={t("step2Desc")}
              />
              <Step
                number="3"
                title={t("step3")}
                description={t("step3Desc")}
              />
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="bg-surface px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold tracking-tight text-foreground">
              {t("testimonials")}
            </h2>
            <div className="mt-16 grid gap-6 sm:grid-cols-3">
              <TestimonialCard
                quote={t("quote1")}
                author="Sarah L."
                role="Product Designer"
              />
              <TestimonialCard
                quote={t("quote2")}
                author="Marcus T."
                role="Sales Lead"
              />
              <TestimonialCard
                quote={t("quote3")}
                author="Priya R."
                role="Founder"
              />
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center sm:px-12">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
            <Sparkles className="relative mx-auto h-8 w-8 text-accent" />
            <h2 className="relative mt-4 text-3xl font-bold tracking-tight text-background">
              {t("ctaTitle")}
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-background/80">
              {t("ctaSubtitle")}
            </p>
            <div className="relative mt-8">
              <Link href="/login?mode=register">
                <Button
                  size="lg"
                  className="bg-background text-primary hover:bg-background/90"
                >
                  {t("createCard")}
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <Logo />
          <div className="flex gap-6 text-sm text-muted">
            <Link href="/login" className="hover:text-foreground">
              {t("login")}
            </Link>
            <Link href="/login?mode=register" className="hover:text-foreground">
              {t("getStarted")}
            </Link>
            <Link href="/u/demo" className="hover:text-foreground">
              {t("demoProfile")}
            </Link>
          </div>
          <p className="text-sm text-muted">
            {t("footerCopy").replace("{year}", String(new Date().getFullYear()))}
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-2xl border border-border bg-surface p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown",
        className,
      ].join(" ")}
    >
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-background">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

function UseCaseCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-surface">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="relative rounded-2xl border border-border bg-background p-6 text-center shadow-card">
      <div className="mx-auto -mt-12 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary text-sm font-bold text-white shadow-sm">
        {number}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

function TestimonialCard({
  quote,
  author,
  role,
}: {
  quote: string;
  author: string;
  role: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-6 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown">
      <p className="text-foreground">“{quote}”</p>
      <div className="mt-4">
        <p className="font-semibold text-foreground">{author}</p>
        <p className="text-sm text-muted">{role}</p>
      </div>
    </div>
  );
}

function DemoProfileCard() {
  const { t } = useI18n();
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-background shadow-xl shadow-primary/5">
      <div className="h-24 bg-gradient-to-br from-secondary via-accent-2 to-accent" />
      <div className="px-6 pb-6">
        <div className="-mt-10 flex items-end justify-between">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-background bg-surface text-2xl font-bold text-secondary shadow-sm">
            JD
          </div>
          <div className="mb-1 rounded-lg bg-surface px-3 py-1 text-xs font-medium text-muted">
            orbitone.com/u/jane-doe
          </div>
        </div>
        <div className="mt-4">
          <h3 className="text-xl font-bold text-foreground">Jane Doe</h3>
          <p className="text-sm text-muted">Product Designer · Colombo</p>
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
          <div>
            <p className="text-lg font-bold text-foreground">1.2k</p>
            <p className="text-xs text-muted">{t("views")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">348</p>
            <p className="text-xs text-muted">{t("saves")}</p>
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">56</p>
            <p className="text-xs text-muted">{t("network")}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-surface py-3 text-sm font-medium text-foreground">
          <QrCode className="h-4 w-4 text-secondary" />
          {t("scanToConnect")}
        </div>
      </div>
    </div>
  );
}
