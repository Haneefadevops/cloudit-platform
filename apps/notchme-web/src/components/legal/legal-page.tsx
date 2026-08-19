import Link from "next/link";

export function LegalPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-primary">
        Pre-launch draft · 19 August 2026
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-lg leading-8 text-muted">{summary}</p>
      <div className="mt-10 space-y-8 text-sm leading-7 text-foreground">
        {children}
      </div>
      <p className="mt-10 rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        These pages describe the current product implementation but remain
        pre-launch drafts. The legal entity, registered address, governing law,
        final retention schedule, and official contact address must be approved
        and published before accepting live customers.
      </p>
      <Link
        className="mt-8 inline-block text-sm font-medium text-primary"
        href="/"
      >
        Return to NotchMe
      </Link>
    </article>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-muted">{children}</div>
    </section>
  );
}
