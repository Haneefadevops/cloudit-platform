import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  QrCode,
  UsersRound,
  UserRoundPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const capabilities = [
  {
    icon: QrCode,
    title: "A page made for sharing",
    description:
      "Give people a polished place to find your details, save your contact, or open your booking link.",
    surface: "bg-secondary",
  },
  {
    icon: UserRoundPlus,
    title: "People, with context",
    description:
      "Keep the people you meet together with the notes and history that make the relationship meaningful.",
    surface: "bg-[#FAEAE3] dark:bg-accent-2",
  },
  {
    icon: CalendarDays,
    title: "Bookings that stay connected",
    description:
      "Offer meeting times from your page and keep booking activity alongside the relationship it started.",
    surface: "bg-[#E8F1F7] dark:bg-accent",
  },
  {
    icon: UsersRound,
    title: "A calmer workspace",
    description:
      "See your page, people, bookings, and relationship activity in one focused workspace.",
    surface: "bg-[#E7F2EC] dark:bg-success-subtle",
  },
];

const workflow = [
  [
    "01",
    "Create your page",
    "Bring your professional details, links, and booking options together.",
  ],
  [
    "02",
    "Make the introduction easy",
    "Share your page in person or online, with QR and vCard options ready when useful.",
  ],
  [
    "03",
    "Keep the relationship moving",
    "Capture the context, see bookings, and return to the people who need your attention.",
  ],
];

const plans = [
  {
    name: "Free",
    price: "€0",
    summary: "A simple way to begin sharing your professional presence.",
    features: [
      "One professional page",
      "QR and vCard sharing",
      "Booking availability",
      "A focused starting workspace",
    ],
    cta: "Create your page",
    featured: false,
  },
  {
    name: "Founding Pro",
    price: "€10",
    summary:
      "For professionals who want NotchMe to support their regular relationship work.",
    features: [
      "Expanded booking allowance",
      "Analytics dashboard",
      "Custom slug priority",
      "Remove NotchMe branding",
    ],
    cta: "Start with Founding Pro",
    featured: true,
  },
  {
    name: "Teams",
    price: "€39",
    summary: "A shared workspace for small professional teams.",
    features: [
      "Includes three users",
      "Workspace and company records",
      "Team administration",
      "Business plan access",
    ],
    cta: "Explore NotchMe",
    featured: false,
  },
];

export default function LandingPage() {
  return (
    <div className="overflow-hidden">
      <section className="relative px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-20 lg:px-8 lg:pb-24 lg:pt-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(ellipse_at_top,_#EFEDFA_0%,_transparent_68%)] dark:bg-none" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Relationship follow-up, made calmer
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Every introduction deserves a next step.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-foreground/75 sm:text-xl">
              NotchMe helps professionals turn introductions into relationships
              they remember and grow — with a professional page, bookings,
              people, and follow-up in one focused place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="w-full sm:w-auto" asChild>
                <Link href="/register">
                  Create your free page <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto"
                asChild
              >
                <Link href="/login">Log in to NotchMe</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-secondary/75 blur-3xl dark:bg-primary/15" />
            <Card className="overflow-hidden border-border bg-surface-elevated">
              <CardContent className="p-0">
                <div className="border-b border-border bg-secondary px-6 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary-foreground">
                    Your relationship workspace
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    A clearer view of what comes next
                  </p>
                </div>
                <div className="space-y-4 p-6">
                  <div className="rounded-xl bg-[#FAF1D8] p-4 dark:bg-warning-subtle">
                    <p className="text-sm font-semibold text-foreground">
                      A new introduction
                    </p>
                    <p className="mt-1 text-sm leading-6 text-foreground/75">
                      Share your page, then keep the context that makes the
                      follow-up personal.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F1F7] text-info dark:bg-accent">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        A meeting booked
                      </p>
                      <p className="text-sm text-foreground/70">
                        Keep the conversation connected to the person.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E7F2EC] text-success dark:bg-success-subtle">
                      <Check className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        A considered next action
                      </p>
                      <p className="text-sm text-foreground/70">
                        Return to the relationships that matter.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section
        id="workflow"
        className="border-y border-border bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              The relationship workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              From a first hello to the right follow-up.
            </h2>
          </div>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {workflow.map(([number, title, description]) => (
              <li
                key={number}
                className="rounded-2xl border border-border bg-surface-elevated p-6 shadow-card"
              >
                <p className="text-sm font-semibold text-primary">{number}</p>
                <h3 className="mt-6 text-lg font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-foreground/75">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="capabilities"
        className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Useful by design
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Everything around the introduction, in its place.
            </h2>
            <p className="mt-4 text-base leading-7 text-foreground/75">
              NotchMe brings together the practical tools around meeting someone
              — without turning your day into CRM administration.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, description, surface }) => (
              <Card key={title} className="h-full">
                <CardContent className="p-6 sm:p-7">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl text-foreground ${surface}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-foreground">
                    {title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-foreground/75">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8"
      >
        <div className="mx-auto max-w-6xl rounded-3xl border border-border bg-[#E8F1F7] px-6 py-10 dark:bg-accent sm:px-10 sm:py-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-info">
              Start simply
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Your first useful NotchMe page is close.
            </h2>
            <p className="mt-4 text-base leading-7 text-foreground/75">
              Create your page, add a meeting type, and share it. The
              relationship workspace is ready to grow with the introductions you
              make.
            </p>
            <Button className="mt-7" asChild>
              <Link href="/register">
                Create your page <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="border-y border-border bg-surface px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Straightforward pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Start free. Grow when the workflow earns its place.
            </h2>
            <p className="mt-4 text-base leading-7 text-foreground/75">
              Founding pricing is available for the pilot. Where billing is
              enabled, secure checkout opens from the signed-in workspace.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.featured
                    ? "relative border-primary bg-surface-elevated"
                    : "bg-surface-elevated"
                }
              >
                <CardContent className="flex h-full flex-col p-6 sm:p-7">
                  {plan.featured && (
                    <span className="mb-5 inline-flex w-fit rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      Founding offer
                    </span>
                  )}
                  <h3 className="text-xl font-semibold text-foreground">
                    {plan.name}
                  </h3>
                  <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                    {plan.price}
                    <span className="ml-1 text-sm font-medium text-foreground/70">
                      /month
                    </span>
                  </p>
                  <p className="mt-4 min-h-12 text-sm leading-6 text-foreground/75">
                    {plan.summary}
                  </p>
                  <ul className="mt-6 space-y-3 text-sm text-foreground/80">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-8 w-full"
                    variant={plan.featured ? "primary" : "outline"}
                    asChild
                  >
                    <Link href="/register">{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl bg-primary px-6 py-10 text-center sm:px-10 sm:py-14">
          <h2 className="text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            Make every introduction easier to remember.
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-primary-foreground opacity-85">
            Create your professional page and begin building a calmer
            relationship workflow today.
          </p>
          <Button
            size="lg"
            className="mt-8 bg-surface-elevated text-foreground hover:bg-background"
            asChild
          >
            <Link href="/register">
              Create your free page <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
