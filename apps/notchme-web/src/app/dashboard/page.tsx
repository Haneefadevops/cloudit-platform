"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Calendar, Check, ChevronRight, CircleAlert, Clock3, Users } from "lucide-react";
import { ActivationChecklist } from "@/components/activation/activation-checklist";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { useDashboardSummary } from "@/hooks/useDashboard";
import { type PersonListItem, usePeople } from "@/hooks/usePeople";
import { useBookings } from "@/hooks/useScheduling";
import { useCompleteCustomerFollowUp } from "@/hooks/useCRM";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 100;

function resolveTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(value));
}

export default function DashboardHomePage() {
  const [timezone, setTimezone] = useState("UTC");
  useEffect(() => setTimezone(resolveTimezone()), []);
  const overdue = usePeople({ view: "overdue", page: 1, pageSize: PAGE_SIZE, timezone });
  const dueToday = usePeople({ view: "due_today", page: 1, pageSize: PAGE_SIZE, timezone });
  const upcoming = usePeople({ view: "upcoming", page: 1, pageSize: PAGE_SIZE, timezone });
  const bookings = useBookings();
  const summary = useDashboardSummary();
  const actionQueries = [overdue, dueToday, upcoming];
  const actionLoading = actionQueries.every((query) => query.isLoading);
  const allActionErrors = actionQueries.every((query) => query.isError);
  const partialFailure = actionQueries.some((query) => query.isError) || bookings.isError;
  const refresh = () => {
    void overdue.refetch(); void dueToday.refetch(); void upcoming.refetch(); void bookings.refetch(); void summary.refetch();
  };
  const overdueItems = overdue.data?.items ?? [];
  const dueItems = dueToday.data?.items ?? [];
  const attentionIds = new Set([...overdueItems, ...dueItems].map((person) => person.id));
  const upcomingPeople = (upcoming.data?.items ?? []).filter((person) => !attentionIds.has(person.id));
  const bookingIdsInPeople = new Set(upcomingPeople.flatMap((person) => person.nextBooking ? [person.nextBooking.id] : []));
  const standaloneBookings = (bookings.data ?? [])
    .filter((booking) => booking.status !== "cancelled" && new Date(booking.startAt) > new Date() && !bookingIdsInPeople.has(booking.id))
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.id.localeCompare(b.id))
    .slice(0, 6);

  if (actionLoading) return <TodaySkeleton />;
  if (allActionErrors) return <FullError onRetry={refresh} />;

  const counts = overdue.data?.counts ?? dueToday.data?.counts ?? upcoming.data?.counts;
  const noAttention = overdueItems.length === 0 && dueItems.length === 0;

  return <div className="min-w-0 p-4 sm:p-6 md:p-8">
    <PageHeader eyebrow="Today" title="Your next actions" description="See who needs attention, what is due, and what is coming up." actions={<Button variant="outline" size="sm" asChild><Link href="/dashboard/customers">Open People</Link></Button>} />

    <ActivationChecklist className="mt-6" />
    {partialFailure && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 text-sm text-muted"><span>Some Today information is temporarily unavailable. Other saved actions are still shown.</span><Button size="sm" variant="outline" onClick={refresh}>Retry</Button></div>}

    <section className="mt-7" aria-labelledby="needs-attention-title">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="needs-attention-title" className="text-lg font-semibold text-foreground">Needs attention</h2><p className="mt-1 text-sm text-muted">Overdue actions first, then actions due today.</p></div>{counts && <span className="rounded-full bg-surface-elevated px-3 py-1 text-sm text-muted">{counts.needs_attention} needing attention</span>}</div>
      {noAttention ? <Card className="mt-4"><CardContent className="p-7 text-center"><Check className="mx-auto h-8 w-8 text-success" /><p className="mt-3 font-medium text-foreground">Nothing needs attention right now.</p><p className="mt-1 text-sm text-muted">Keep the momentum with an upcoming action or meeting.</p></CardContent></Card> : <div className="mt-4 grid gap-3 xl:grid-cols-2"><ActionGroup label="Overdue" tone="overdue" people={overdueItems} timezone={timezone} /><ActionGroup label="Due today" tone="today" people={dueItems} timezone={timezone} /></div>}
    </section>

    <section className="mt-8" aria-labelledby="upcoming-title"><div><h2 id="upcoming-title" className="text-lg font-semibold text-foreground">Upcoming</h2><p className="mt-1 text-sm text-muted">Future follow-ups and meetings, ordered by the nearest supported action.</p></div><div className="mt-4 grid gap-3 xl:grid-cols-2"><UpcomingPeople people={upcomingPeople} timezone={timezone} />{standaloneBookings.map((booking) => <Card key={booking.id}><CardContent className="flex min-w-0 items-center gap-3 p-4"><Calendar className="h-5 w-5 shrink-0 text-secondary" /><div className="min-w-0 flex-1"><p className="font-medium text-foreground">{booking.guest?.name ?? "Upcoming meeting"}</p><p className="truncate text-sm text-muted">{booking.meetingType?.title ?? "Meeting"} · {formatDate(booking.startAt, timezone)}</p></div><Button variant="outline" size="sm" asChild><Link href="/dashboard/scheduling/bookings">Bookings</Link></Button></CardContent></Card>)}</div>{upcomingPeople.length === 0 && standaloneBookings.length === 0 && <Card className="mt-4"><CardContent className="p-6 text-center text-sm text-muted">No upcoming meetings or future actions.</CardContent></Card>}</section>

    <section className="mt-8 grid gap-5 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Relationship context</CardTitle></CardHeader><CardContent><p className="text-sm text-muted">Recent factual relationship activity remains available on each Person&apos;s timeline. Choose a person to add an activity, review context, or set a next action.</p><Button className="mt-4" variant="outline" asChild><Link href="/dashboard/customers">Browse People<ChevronRight className="h-4 w-4" /></Link></Button></CardContent></Card><Metrics summary={summary.data} loading={summary.isLoading} /></section>
  </div>;
}

function ActionGroup({ label, tone, people, timezone }: { label: string; tone: "overdue" | "today"; people: PersonListItem[]; timezone: string }) {
  if (people.length === 0) return null;
  return <Card className={tone === "overdue" ? "border-error/30" : "border-secondary/30"}><CardHeader className="pb-2"><CardTitle className="text-base">{label}</CardTitle></CardHeader><CardContent className="space-y-3">{people.map((person) => <TodayAction key={person.id} person={person} timezone={timezone} tone={tone} />)}</CardContent></Card>;
}

function TodayAction({ person, timezone, tone }: { person: PersonListItem; timezone: string; tone: "overdue" | "today" }) {
  const complete = useCompleteCustomerFollowUp(person.id);
  const [message, setMessage] = useState<string | null>(null);
  const action = person.nextFollowUp;
  const markComplete = async () => {
    if (!action) return;
    setMessage(null);
    try { await complete.mutateAsync({ followUpId: action.id, completed: true }); setMessage("Completed."); } catch { setMessage("Could not complete this action. Try again."); }
  };
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="flex min-w-0 items-start gap-3"><CircleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "overdue" ? "text-error" : "text-secondary")} /><div className="min-w-0 flex-1"><Link href={`/dashboard/customers/${person.id}`} className="font-medium text-primary hover:underline">{person.displayName}</Link><p className="mt-1 break-words text-sm text-foreground">{action?.title ?? "Follow-up due"}</p><p className={cn("mt-1 text-xs", tone === "overdue" ? "text-error" : "text-muted")}>{tone === "overdue" ? "Overdue" : "Due today"} · {action ? formatDate(action.dueAt, timezone) : ""}</p></div></div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={markComplete} disabled={!action || complete.isPending} isLoading={complete.isPending}><Check className="h-4 w-4" />Complete</Button><Button size="sm" variant="outline" asChild><Link href={`/dashboard/customers/${person.id}`}>Open Person</Link></Button></div>{message && <p className="mt-2 text-xs text-muted" role="status">{message}</p>}</div>;
}

function UpcomingPeople({ people, timezone }: { people: PersonListItem[]; timezone: string }) {
  return <>{people.slice(0, 8).map((person) => { const event = person.nextFollowUp && person.nextBooking ? (new Date(person.nextFollowUp.dueAt) <= new Date(person.nextBooking.startAt) ? { label: person.nextFollowUp.title, at: person.nextFollowUp.dueAt, icon: Clock3 } : { label: "Upcoming meeting", at: person.nextBooking.startAt, icon: Calendar }) : person.nextFollowUp ? { label: person.nextFollowUp.title, at: person.nextFollowUp.dueAt, icon: Clock3 } : person.nextBooking ? { label: "Upcoming meeting", at: person.nextBooking.startAt, icon: Calendar } : null; if (!event) return null; const Icon = event.icon; return <Card key={person.id}><CardContent className="flex min-w-0 items-center gap-3 p-4"><Icon className="h-5 w-5 shrink-0 text-secondary" /><div className="min-w-0 flex-1"><Link href={`/dashboard/customers/${person.id}`} className="font-medium text-primary hover:underline">{person.displayName}</Link><p className="truncate text-sm text-muted">{event.label} · {formatDate(event.at, timezone)}</p></div><Button size="sm" variant="outline" asChild><Link href={`/dashboard/customers/${person.id}`}>Open</Link></Button></CardContent></Card>; })}</>;
}

function Metrics({ summary, loading }: { summary: import("@/lib/contracts").DashboardSummary | undefined; loading: boolean }) {
  return <Card><CardHeader><CardTitle className="text-base">Workspace metrics</CardTitle></CardHeader><CardContent>{loading ? <Skeleton className="h-20 w-full" /> : <div className="grid grid-cols-2 gap-3"><Metric value={summary?.profileMetrics.bookingsCreated ?? 0} label="Bookings" /><Metric value={summary?.crmSummary?.totalCustomers ?? 0} label="People" /></div>}<Button className="mt-4 w-full" size="sm" variant="outline" asChild><Link href="/dashboard/analytics">View analytics</Link></Button></CardContent></Card>;
}

function Metric({ value, label }: { value: number; label: string }) { return <div className="rounded-lg bg-surface-elevated p-3"><p className="text-2xl font-semibold text-foreground">{value}</p><p className="text-xs text-muted">{label}</p></div>; }
function TodaySkeleton() { return <div className="p-4 sm:p-6"><Skeleton className="h-24 w-full" /><div className="mt-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" /></div></div>; }
function FullError({ onRetry }: { onRetry: () => void }) { return <div className="p-4 sm:p-6"><Card><CardContent className="p-8 text-center"><CircleAlert className="mx-auto h-8 w-8 text-muted" /><p className="mt-3 font-medium text-foreground">Today is temporarily unavailable.</p><p className="mt-1 text-sm text-muted">Your saved actions have not changed. Try again shortly.</p><Button className="mt-4" onClick={onRetry}>Try again</Button></CardContent></Card></div>; }
