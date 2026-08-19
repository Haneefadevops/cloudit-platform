"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cancelGuestBooking, getGuestManagedBooking, rescheduleGuestBooking, usePublicBookingSlots } from "@/hooks/usePublicBooking";
import { downloadGuestBookingIcs } from "@/lib/guest-calendar";
import type { GuestManagedBooking } from "@/lib/contracts";

function timeLabel(iso: string, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(iso));
}

export default function GuestManagementPage() {
  const { token } = useParams<{ token: string }>();
  const [booking, setBooking] = useState<GuestManagedBooking | null>(null);
  const [state, setState] = useState<"loading" | "invalid" | "error" | "ready">("loading");
  const [timezone, setTimezone] = useState("UTC");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setState("loading"); setMessage("");
    try { setBooking(await getGuestManagedBooking(token)); setState("ready"); }
    catch { setState("invalid"); }
  }, [token]);
  useEffect(() => { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); void refresh(); }, [refresh]);
  const range = useMemo(() => ({ from: new Date().toISOString(), to: new Date(Date.now() + 14 * 86400000).toISOString() }), []);
  const slots = usePublicBookingSlots(booking?.profileSlug ?? "", booking?.meetingTypeSlug ?? "", range.from, range.to, timezone);

  const reschedule = async () => {
    if (!selectedSlot) return;
    setPending(true); setMessage("");
    try { await rescheduleGuestBooking(token, selectedSlot, timezone); setRescheduleOpen(false); setSelectedSlot(null); await refresh(); }
    catch { setMessage("That time is no longer available. Please choose another available time."); slots.refetch(); }
    finally { setPending(false); }
  };
  const cancel = async () => {
    const cancelToken = typeof window === "undefined" ? "" : new URLSearchParams(window.location.hash.slice(1)).get("cancel") ?? token;
    setPending(true); setMessage("");
    try { await cancelGuestBooking(cancelToken); setCancelOpen(false); await refresh(); }
    catch { setMessage("We could not cancel this booking. Please try again."); }
    finally { setPending(false); }
  };

  if (state === "loading") return <main className="mx-auto max-w-xl px-4 py-12"><Skeleton className="h-64 w-full" /></main>;
  if (state === "invalid" || !booking) return <main className="mx-auto max-w-xl px-4 py-12"><Card><CardContent className="space-y-4 p-6 text-center"><XCircle className="mx-auto h-10 w-10 text-muted" /><h1 className="text-xl font-semibold">Booking link unavailable</h1><p className="text-muted">This link is invalid or has expired.</p><Button asChild variant="outline"><Link href="/">Go to NotchMe</Link></Button></CardContent></Card></main>;
  const active = booking.cancellationAllowed || booking.reschedulingAllowed;
  return <main className="mx-auto max-w-xl px-4 py-8"><Card><CardHeader><CardTitle>Manage your booking</CardTitle></CardHeader><CardContent className="space-y-5"><div role="status" className="rounded-lg border border-border bg-surface p-4 text-sm"><p className="font-semibold">{booking.meetingTypeTitle} with {booking.hostName}</p><p className="mt-1">{timeLabel(booking.startAt, booking.timezone)} – {timeLabel(booking.endAt, booking.timezone)}</p><p className="mt-1 text-muted">Display timezone: {booking.timezone}</p><p className="mt-1 capitalize text-muted">Status: {booking.status}</p></div>{message && <p role="alert" className="text-sm text-error">{message}</p>}<div className="flex flex-col gap-3 sm:flex-row"><Button type="button" onClick={() => downloadGuestBookingIcs(booking)}><CalendarDays className="h-4 w-4" />Add to calendar</Button>{booking.reschedulingAllowed && <Button type="button" variant="outline" onClick={() => setRescheduleOpen(true)}>Reschedule</Button>}{booking.cancellationAllowed && <Button type="button" variant="danger" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}</div>{!active && <p className="text-sm text-muted">This booking can no longer be changed here.</p>}<Link className="inline-flex min-h-11 items-center text-sm underline" href={`/p/${booking.profileSlug}`}>Return to profile</Link></CardContent></Card>
    <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}><DialogContent><DialogHeader><DialogTitle>Choose a new time</DialogTitle></DialogHeader><p className="mb-3 text-sm text-muted">Current: {timeLabel(booking.startAt, booking.timezone)}. Times are shown in {timezone}.</p><div className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">{slots.isLoading ? <Skeleton className="col-span-2 h-20" /> : slots.data?.slots.filter((slot) => slot.available).map((slot) => <button key={slot.startAt} type="button" onClick={() => setSelectedSlot(slot.startAt)} className={`min-h-11 rounded border p-2 text-sm ${selectedSlot === slot.startAt ? "border-secondary bg-secondary/10" : "border-border"}`}>{timeLabel(slot.startAt, timezone)}</button>)}</div><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setRescheduleOpen(false)}>Back</Button><Button disabled={!selectedSlot} isLoading={pending} onClick={reschedule}>Confirm new time</Button></div></DialogContent></Dialog>
    <Dialog open={cancelOpen} onOpenChange={setCancelOpen}><DialogContent><DialogHeader><DialogTitle>Cancel this booking?</DialogTitle></DialogHeader><p className="text-sm text-muted">Cancellation cannot be undone through this interface.</p><div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setCancelOpen(false)}>Keep booking</Button><Button variant="danger" isLoading={pending} onClick={cancel}>Cancel booking</Button></div></DialogContent></Dialog>
  </main>;
}
