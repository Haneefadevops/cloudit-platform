"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteMeetingRecap,
  useFinalizeMeetingRecap,
  useMeetingRecap,
  useSaveMeetingRecap,
} from "@/hooks/useMeetingRecap";

export function MeetingRecapButton({
  bookingId,
  customerId,
}: {
  bookingId: string;
  customerId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        Meeting recap
      </Button>
      <MeetingRecapDialog
        bookingId={bookingId}
        customerId={customerId}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

function MeetingRecapDialog({
  bookingId,
  customerId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  customerId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const recapQuery = useMeetingRecap(bookingId, open);
  const save = useSaveMeetingRecap(bookingId, customerId);
  const remove = useDeleteMeetingRecap(bookingId, customerId);
  const finalize = useFinalizeMeetingRecap(bookingId, customerId);
  const [mode, setMode] = useState<"edit" | "review">("edit");
  const [summary, setSummary] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [commitments, setCommitments] = useState("");
  const [privateNote, setPrivateNote] = useState("");
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [createFollowUp, setCreateFollowUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const recap = recapQuery.data;
    if (!open || !recap) return;
    setSummary(recap.summary);
    setKeyPoints(recap.keyPoints.join("\n"));
    setCommitments(recap.commitments.join("\n"));
    setPrivateNote(recap.privateNote ?? "");
    setFollowUpTitle(recap.proposedFollowUpTitle ?? "");
    setFollowUpDueAt(
      recap.proposedFollowUpDueAt
        ? new Date(recap.proposedFollowUpDueAt).toISOString().slice(0, 16)
        : "",
    );
    if (recap.status === "finalized") setMode("review");
  }, [open, recapQuery.data]);

  const draft = () => ({
    summary,
    keyPoints: keyPoints
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
    commitments: commitments
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean),
    privateNote: privateNote || null,
    proposedFollowUpTitle: followUpTitle || null,
    proposedFollowUpDueAt: followUpDueAt
      ? new Date(followUpDueAt).toISOString()
      : null,
  });

  const saveDraft = async () => {
    setMessage(null);
    try {
      await save.mutateAsync(draft());
      setMessage("Draft saved privately.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save draft.",
      );
    }
  };

  const finalizeRecap = async () => {
    setMessage(null);
    if (!summary.trim()) {
      setMessage("Add a summary before finalizing.");
      return;
    }
    if (createFollowUp && (!followUpTitle.trim() || !followUpDueAt)) {
      setMessage("Add a next-action title and future due time.");
      return;
    }
    try {
      await save.mutateAsync(draft());
      await finalize.mutateAsync({
        createFollowUp,
        ...(createFollowUp
          ? {
              followUpTitle: followUpTitle.trim(),
              followUpDueAt: new Date(followUpDueAt).toISOString(),
            }
          : {}),
      });
      setMessage("Recap finalized and added to the relationship timeline.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to finalize recap.",
      );
    }
  };

  const deleteDraft = async () => {
    if (!window.confirm("Delete this private recap draft?")) return;
    await remove.mutateAsync();
    setSummary("");
    setKeyPoints("");
    setCommitments("");
    setPrivateNote("");
    setMessage("Draft deleted.");
  };

  const finalized = recapQuery.data?.status === "finalized";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {finalized ? "Meeting recap" : "Review the meeting"}
          </DialogTitle>
          <p className="mt-1 text-sm text-muted">
            Drafts stay private. Nothing reaches the timeline until you confirm
            it.
          </p>
        </DialogHeader>
        {recapQuery.isLoading ? (
          <p className="text-sm text-muted">Loading recap…</p>
        ) : recapQuery.isError ? (
          <div role="alert" className="space-y-3 text-sm text-error">
            <p>Unable to load this recap.</p>
            <Button variant="outline" onClick={() => recapQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : mode === "edit" && !finalized ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor={`recap-summary-${bookingId}`}>
                Meeting summary
              </Label>
              <Textarea
                id={`recap-summary-${bookingId}`}
                rows={5}
                maxLength={2000}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor={`recap-points-${bookingId}`}>
                  Key points <span className="text-muted">(one per line)</span>
                </Label>
                <Textarea
                  id={`recap-points-${bookingId}`}
                  rows={5}
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor={`recap-commitments-${bookingId}`}>
                  Commitments <span className="text-muted">(one per line)</span>
                </Label>
                <Textarea
                  id={`recap-commitments-${bookingId}`}
                  rows={5}
                  value={commitments}
                  onChange={(e) => setCommitments(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor={`recap-private-${bookingId}`}>
                Private relationship note
              </Label>
              <Textarea
                id={`recap-private-${bookingId}`}
                rows={3}
                maxLength={2000}
                value={privateNote}
                onChange={(e) => setPrivateNote(e.target.value)}
              />
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <p className="font-medium text-foreground">
                Proposed next action
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`recap-followup-${bookingId}`}>Action</Label>
                  <Input
                    id={`recap-followup-${bookingId}`}
                    maxLength={160}
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`recap-due-${bookingId}`}>Due</Label>
                  <Input
                    id={`recap-due-${bookingId}`}
                    type="datetime-local"
                    value={followUpDueAt}
                    onChange={(e) => setFollowUpDueAt(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={saveDraft} isLoading={save.isPending}>
                Save private draft
              </Button>
              <Button variant="secondary" onClick={() => setMode("review")}>
                Review before finalizing
              </Button>
              {recapQuery.data && (
                <Button
                  variant="ghost"
                  onClick={deleteDraft}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete draft
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <RecapReview label="Summary" value={summary} />
            <RecapReview label="Key points" value={keyPoints} />
            <RecapReview label="Commitments" value={commitments} />
            <RecapReview
              label="Private note"
              value={privateNote}
              privateValue
            />
            {!finalized && (
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border p-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={createFollowUp}
                  onChange={(e) => setCreateFollowUp(e.target.checked)}
                />
                Create the proposed next action after finalizing
              </label>
            )}
            {!finalized && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => setMode("edit")}>
                  Back to edit
                </Button>
                <Button
                  onClick={finalizeRecap}
                  isLoading={save.isPending || finalize.isPending}
                >
                  Confirm and finalize
                </Button>
              </div>
            )}
          </div>
        )}
        {message && (
          <p className="mt-4 text-sm text-muted" role="status">
            {message}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RecapReview({
  label,
  value,
  privateValue = false,
}: {
  label: string;
  value: string;
  privateValue?: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
        {privateValue ? " · private" : ""}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
        {value || "Not added"}
      </p>
    </section>
  );
}
