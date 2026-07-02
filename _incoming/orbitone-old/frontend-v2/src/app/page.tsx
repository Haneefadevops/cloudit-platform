import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/brand/logo";
import {
  QrCode,
  Calendar,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Check,
  Zap,
  Globe,
} from "lucide-react";

const features = [
  {
    icon: QrCode,
    title: "Digital card + QR",
    description: "Share your profile instantly with a QR code or short link.",
    className: "md:col-span-2",
  },
  {
    icon: Calendar,
    title: "Smart booking",
    description: "Let leads book time with you online. Free up to 3/week.",
  },
  {
    icon: TrendingUp,
    title: "Analytics",
    description: "Track views, scans, and bookings from one place.",
  },
  {
    icon: Users,
    title: "Light CRM",
    description: "Manage customers, follow-ups, and ratings on Pro Business.",
    className: "md:col-span-2",
  },
  {
    icon: Globe,
    title: "Save as vCard",
    description: "One-tap contact download for every profile visitor.",
  },
];

const steps = [
  { title: "Create your profile", body: "Add your details, photo, and links in under a minute." },
  { title: "Share your QR", body: "Print, text, or show your QR code at meetings and events." },
  { title: "Turn intros into opportunities", body: "Get booked, build relationships, and grow your network." },
];

export function LandingPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-[32rem] w-[32rem] rounded-full bg-secondary/20 blur-[120px]" />
        <div className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-[24rem] w-[24rem] rounded-full bg-primary/30 blur-[120px]" />
      </div>

      {/* Hero */}
      <section className="relative px-4 pt-24 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-1.5 text-sm text-muted backdrop-blur">
            <Sparkles className="h-4 w-4 text-accent" />
            <span>Built for Sri Lankan professionals</span>
          </div>

          <h1 className="text-balance text-5xl font-semibold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Turn every
            <br />
            <span className="bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent">
              introduction
            </span>{" "}
            into opportunity
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            OrbitOne is the digital business card that makes networking effortless.
            Share your QR, get booked, and build stronger professional relationships.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="group bg-gradient-to-r from-secondary to-primary px-8" asChild>
              <Link to="/register">
                Create free profile
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>

          {/* Abstract orb */}
          <div className="relative mx-auto mt-16 flex h-72 w-72 items-center justify-center sm:h-96 sm:w-96">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-secondary/40 via-accent/20 to-primary/40 blur-2xl" />
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-secondary to-primary opacity-80 blur-xl" />
            <div className="absolute inset-16 rounded-full bg-gradient-to-br from-accent/80 to-secondary/80 opacity-90 blur-md" />
            <div className="relative z-10 rounded-full border border-white/10 bg-surface/30 p-8 backdrop-blur-xl">
              <Logo className="h-20 w-20 text-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* Logo strip */}
      <section className="border-y border-border/50 bg-surface/40 py-8 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-8 px-4 text-sm font-medium text-muted">
          <span>Trusted by professionals at</span>
          <span className="opacity-60">CloudIT</span>
          <span className="opacity-60">Neo Lanka</span>
          <span className="opacity-60">Synergy Labs</span>
          <span className="opacity-60">Ceylon Digital</span>
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Everything you need to network smarter
            </h2>
            <p className="mt-4 text-muted">
              From first scan to follow-up, OrbitOne keeps you connected.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card
                key={f.title}
                className={`group border-border/60 bg-surface/40 backdrop-blur transition-all hover:-translate-y-1 hover:border-secondary/40 hover:bg-surface-elevated/60 ${f.className ?? ""}`}
              >
                <CardContent className="flex h-full flex-col p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 text-secondary ring-1 ring-inset ring-white/10">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            How it works
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Card key={s.title} className="border-border/60 bg-surface/40 backdrop-blur">
                <CardContent className="p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-secondary to-primary font-bold text-background">
                    {i + 1}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted">{s.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Simple pricing
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            <Card className="border-border/60 bg-surface/40 backdrop-blur">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-foreground">Free</h3>
                <p className="mt-2 text-3xl font-bold text-foreground">LKR 0</p>
                <ul className="mt-6 space-y-3 text-sm text-muted">
                  {["Digital card + QR", "vCard download", "Up to 3 bookings/week"].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-secondary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant="outline" asChild>
                  <Link to="/register">Get started</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="relative overflow-hidden border-secondary/40 bg-surface-elevated/60 backdrop-blur">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-secondary to-accent" />
              <CardContent className="p-6">
                <div className="mb-2 inline-flex items-center rounded-full bg-secondary/10 px-2.5 py-0.5 text-xs font-medium text-secondary">
                  Most popular
                </div>
                <h3 className="text-xl font-semibold text-foreground">Pro Individual</h3>
                <p className="mt-2 text-3xl font-bold text-foreground">LKR 1,990</p>
                <p className="text-sm text-muted">/month</p>
                <ul className="mt-6 space-y-3 text-sm text-muted">
                  {[
                    "Unlimited bookings",
                    "Analytics dashboard",
                    "Custom slug priority",
                    "Remove OrbitOne branding",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-secondary" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full bg-gradient-to-r from-secondary to-primary" asChild>
                  <Link to="/register">Upgrade to Pro</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl bg-gradient-to-br from-primary to-secondary p-10 text-center text-background sm:p-16">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to upgrade your networking?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-background/80">
            Join professionals who turn every introduction into an opportunity.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-background text-foreground hover:bg-background/90"
            asChild
          >
            <Link to="/register">
              <Zap className="mr-2 h-4 w-4" />
              Create free profile
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
