"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, Copy, Kanban, Plus, Search, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { peopleViews, type PeopleView, type PersonListItem, usePeople } from "@/hooks/usePeople";
import { useCreateCustomer } from "@/hooks/useCRM";

const PAGE_SIZE = 20;

const views: { id: PeopleView; label: string }[] = [
  { id: "needs_attention", label: "Needs attention" },
  { id: "due_today", label: "Due today" },
  { id: "overdue", label: "Overdue" },
  { id: "upcoming", label: "Upcoming" },
  { id: "recent", label: "Recently added" },
  { id: "all", label: "All people" },
];

function isPeopleView(value: string | null): value is PeopleView {
  return !!value && (peopleViews as readonly string[]).includes(value);
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function formatDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(value));
}

function lifecycleLabel(value: string) {
  return value.replace(/_/g, " ");
}

export default function CustomersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const view: PeopleView = isPeopleView(requestedView) ? requestedView : "needs_attention";
  const search = searchParams.get("search") ?? "";
  const requestedPage = Number(searchParams.get("page"));
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [timezone, setTimezone] = useState("UTC");
  const [searchInput, setSearchInput] = useState(search);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => setTimezone(browserTimezone()), []);
  useEffect(() => setSearchInput(search), [search]);

  const people = usePeople({ view, search: search || undefined, page, pageSize: PAGE_SIZE, timezone });
  const updateQuery = (changes: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    router.replace(`${pathname}${params.size ? `?${params.toString()}` : ""}`, { scroll: false });
  };
  const changeView = (nextView: PeopleView) => updateQuery({ view: nextView === "needs_attention" ? undefined : nextView, page: undefined });
  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateQuery({ search: searchInput.trim() || undefined, page: undefined });
  };

  return (
    <div className="min-w-0 p-4 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">People</h1>
          <p className="mt-1 text-muted">Keep relationships moving with the next clear action.</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <Button onClick={() => setAddOpen(true)}><Plus className="h-4 w-4" />Add person</Button>
          <WorkspaceTools />
        </div>
      </div>

      <form onSubmit={submitSearch} className="mt-6 flex gap-2">
        <label className="relative min-w-0 flex-1" htmlFor="people-search">
          <span className="sr-only">Search people</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input id="people-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="h-11 pl-9" placeholder="Search people, companies, email, or phone" />
        </label>
        <Button type="submit" variant="outline" className="h-11">Search</Button>
      </form>

      <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="tablist" aria-label="People smart views">
        <div className="flex min-w-max gap-2">
          {views.map((item) => {
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => changeView(item.id)}
                className={cn("min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-foreground hover:bg-surface-elevated")}
              >
                {item.label}
                <span className="ml-2 text-xs opacity-80">{people.data?.counts[item.id] ?? "—"}</span>
              </button>
            );
          })}
        </div>
      </div>

      {people.isLoading ? <PeopleLoading /> : people.isError ? (
        <StateCard title="People could not be loaded" detail="Your People workspace is unavailable right now. Please try again." action={<Button onClick={() => people.refetch()}>Try again</Button>} />
      ) : !people.data || people.data.items.length === 0 ? (
        <EmptyState view={view} search={search} />
      ) : (
        <>
          {people.isFetching && <p className="mt-4 text-sm text-muted" role="status">Updating people…</p>}
          <p className="mt-5 text-sm text-muted">{people.data.total} {people.data.total === 1 ? "person" : "people"} in this view</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {people.data.items.map((person) => <PersonCard key={person.id} person={person} timezone={timezone} />)}
          </div>
          <Pagination page={page} totalPages={people.data.totalPages} onPage={(nextPage) => updateQuery({ page: nextPage === 1 ? undefined : String(nextPage) })} />
        </>
      )}
      <AddPersonDialog open={addOpen} onOpenChange={setAddOpen} onCreated={() => people.refetch()} />
    </div>
  );
}

function WorkspaceTools() {
  return <div className="rounded-xl border border-border bg-surface p-2">
    <p className="px-2 pb-1 text-xs font-medium text-muted">Workspace tools</p>
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" size="sm" asChild><Link href="/dashboard/customers/pipeline"><Kanban className="h-4 w-4" />Pipeline</Link></Button>
      <Button variant="ghost" size="sm" asChild><Link href="/dashboard/customers/duplicates"><Copy className="h-4 w-4" />Duplicates</Link></Button>
      <Button variant="ghost" size="sm" asChild><Link href="/dashboard/settings"><Settings2 className="h-4 w-4" />CRM settings</Link></Button>
    </div>
  </div>;
}

function AddPersonDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => void }) {
  const create = useCreateCustomer();
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await create.mutateAsync({
      fullName: String(form.get("fullName")),
      company: String(form.get("company") || "") || null,
      email: String(form.get("email") || "") || null,
      phone: String(form.get("phone") || "") || null,
      source: "manual",
    });
    onOpenChange(false);
    onCreated();
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Add person</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4 pt-2">
        <div><Label htmlFor="person-name">Name</Label><Input id="person-name" name="fullName" required /></div>
        <div><Label htmlFor="person-company">Company</Label><Input id="person-company" name="company" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label htmlFor="person-email">Email</Label><Input id="person-email" name="email" type="email" /></div>
          <div><Label htmlFor="person-phone">Phone</Label><Input id="person-phone" name="phone" type="tel" /></div>
        </div>
        <Button type="submit" className="w-full" disabled={create.isPending}>{create.isPending ? "Saving..." : "Save person"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}

function PersonCard({ person, timezone }: { person: PersonListItem; timezone: string }) {
  const contact = person.email ?? person.phone;
  const followUp = person.nextFollowUp;
  return <Card className="min-w-0 transition-shadow hover:shadow-sm">
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/dashboard/customers/${person.id}`} className="text-base font-semibold text-primary hover:underline">{person.displayName}</Link>
          {person.company && <p className="truncate text-sm text-muted">{person.company}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-surface-elevated px-2 py-1 text-xs font-medium capitalize text-foreground">{lifecycleLabel(person.lifecycleStage)}</span>
      </div>
      <div className="mt-4 space-y-2 text-sm">
        <p className="truncate text-muted">{contact ?? "No contact method saved"}</p>
        <p className="text-muted">{person.lastInteractionAt ? `Last interaction: ${formatDate(person.lastInteractionAt, timezone)}` : "No interaction recorded"}</p>
        {followUp ? <p className={cn("rounded-md px-2 py-1", followUp.dueAt < new Date().toISOString() ? "bg-error/10 text-error" : "bg-surface-elevated text-foreground")}><span className="font-medium">Next action:</span> {followUp.title} · {formatDate(followUp.dueAt, timezone)}</p> : <p className="text-muted">No next action set</p>}
        {person.nextBooking && <p className="flex items-start gap-2 text-muted"><Calendar className="mt-0.5 h-4 w-4 shrink-0" />Upcoming booking: {formatDate(person.nextBooking.startAt, timezone)}</p>}
      </div>
    </CardContent>
  </Card>;
}

function PeopleLoading() {
  return <div className="mt-6 grid gap-3 lg:grid-cols-2" aria-label="Loading people" aria-busy="true">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-48 w-full" />)}</div>;
}

function StateCard({ title, detail, action }: { title: string; detail: string; action?: React.ReactNode }) {
  return <Card className="mt-6"><CardContent className="p-8 text-center"><Users className="mx-auto h-10 w-10 text-muted" /><h2 className="mt-3 font-medium text-foreground">{title}</h2><p className="mt-1 text-sm text-muted">{detail}</p>{action && <div className="mt-4">{action}</div>}</CardContent></Card>;
}

function EmptyState({ view, search }: { view: PeopleView; search: string }) {
  if (search) return <StateCard title="No matching people" detail={`No people match “${search}”. Try a different name, company, email, or phone.`} />;
  if (view === "all") return <StateCard title="No people yet" detail="People you add or capture through your workspace will appear here." />;
  return <StateCard title="Nothing in this view" detail="This smart view is clear. Select All people to browse your relationships." />;
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return <nav className="mt-6 flex items-center justify-between gap-3" aria-label="People pages">
    <Button variant="outline" onClick={() => onPage(page - 1)} disabled={page <= 1}><ChevronLeft className="h-4 w-4" />Previous</Button>
    <span className="text-sm text-muted">Page {page} of {totalPages}</span>
    <Button variant="outline" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>Next<ChevronRight className="h-4 w-4" /></Button>
  </nav>;
}
