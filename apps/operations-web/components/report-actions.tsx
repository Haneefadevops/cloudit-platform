"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReportCommandType } from "../lib/operations-api";

// Server-provided, browser-safe props only: no secrets, tokens beyond the
// per-render CSRF pair, recipient addresses, row versions or signatures.
export interface ReportActionsProps {
  reportKey: string;
  clientDisplayName: string;
  reportMonth: string;
  documentStatus: string | null;
  pdfAvailable: boolean;
  actions: { approveAndSend: boolean; reject: boolean; retrySend: boolean };
  csrf: {
    actionNonce: string;
    // One CSRF token per command type; the server derives each as
    // base64url(HMAC-SHA256(SESSION_SECRET, "email|reportKey|commandType|csrf|actionNonce")).
    tokens: { approveAndSend: string; reject: string; retrySend: string };
  };
  // One idempotency key per command type; the server derives each as
  // base64url(HMAC-SHA256(SESSION_SECRET, "email|reportKey|commandType|actionNonce")).
  // The "|csrf|" segment in the CSRF derivation keeps the two tokens distinct.
  requestKeys: { approveAndSend: string; reject: string; retrySend: string };
}

type ActionKind = "approveAndSend" | "reject" | "retrySend";

const ACTION_DEFS: Record<
  ActionKind,
  {
    commandType: ReportCommandType;
    buttonLabel: string;
    title: string;
    confirmLabel: string;
    variant: "primary" | "danger";
    showsRecipientPolicy: boolean;
    requiresRepeatAck: boolean;
  }
> = {
  approveAndSend: {
    commandType: "APPROVE_AND_SEND",
    buttonLabel: "Approve & send",
    title: "Approve and send this report",
    confirmLabel: "Approve & send",
    variant: "primary",
    showsRecipientPolicy: true,
    requiresRepeatAck: false,
  },
  reject: {
    commandType: "REJECT",
    buttonLabel: "Reject report",
    title: "Reject this report",
    confirmLabel: "Reject report",
    variant: "danger",
    showsRecipientPolicy: false,
    requiresRepeatAck: false,
  },
  retrySend: {
    commandType: "RETRY_SEND",
    buttonLabel: "Retry send",
    title: "Retry sending this report",
    confirmLabel: "Retry send",
    variant: "primary",
    showsRecipientPolicy: true,
    requiresRepeatAck: true,
  },
};

// Closed label map: known safe result codes from the command route, mapped to
// friendly strings. Unknown codes fall back to "Completed".
const RESULT_LABELS: Record<string, string> = {
  acknowledged: "Approved — sending is scheduled",
  rejected_state: "No change: the report state changed just now",
  rejected_expired: "No change: this action window has expired",
  dispatch_pending: "Handed off — status updates shortly",
};

const DENIAL_LABELS: Record<string, string> = {
  ineligible_state: "No change: this report is not in an actionable state",
  rate_limited: "Too many attempts — please wait a few minutes and try again",
};

interface CommandResult {
  status: string;
  resultCode: string | null;
  denialCode: string | null;
  alreadyRecorded: boolean;
}

interface HistoryItem {
  commandType: string;
  status: string;
  resultCode: string | null;
  requestedAt: string;
  completedAt: string | null;
}

function monthLabel(month: string): string {
  const value = new Date(`${month}T00:00:00Z`);
  return Number.isNaN(value.getTime())
    ? month
    : value.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function friendlyCommandStatus(item: Pick<HistoryItem, "status" | "resultCode">): string {
  if (item.resultCode && RESULT_LABELS[item.resultCode]) return RESULT_LABELS[item.resultCode];
  if (item.status === "denied") return "Denied by policy";
  return RESULT_LABELS[item.status] ?? "Completed";
}

function friendlyResult(result: CommandResult): string {
  if (result.alreadyRecorded) return "Already recorded — no duplicate action was created.";
  if (result.status === "denied") {
    return DENIAL_LABELS[result.denialCode ?? ""] ?? "The action was denied by policy.";
  }
  return RESULT_LABELS[result.resultCode ?? ""] ?? "Completed";
}

export function ReportActions(props: ReportActionsProps) {
  const router = useRouter();
  const uid = useId();
  const dialogRefs = useRef<Record<ActionKind, HTMLDialogElement | null>>({
    approveAndSend: null,
    reject: null,
    retrySend: null,
  });

  const [active, setActive] = useState<ActionKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommandResult | null>(null);
  const [history, setHistory] = useState<{ loading: boolean; error: string | null; items: HistoryItem[] | null }>({
    loading: false,
    error: null,
    items: null,
  });

  useEffect(() => {
    if (!active) return;
    const dialog = dialogRefs.current[active];
    if (!dialog || dialog.open) return;
    dialog.showModal();
    const firstField = dialog.querySelector<HTMLElement>("input:not([type=hidden]), textarea");
    firstField?.focus();
  }, [active]);

  const closeDialog = () => {
    const dialog = active ? dialogRefs.current[active] : null;
    if (dialog?.open) dialog.close();
  };

  const resetDialogState = () => {
    setActive(null);
    setBusy(false);
    setError(null);
    setResult(null);
    setHistory({ loading: false, error: null, items: null });
  };

  const openDialog = (kind: ActionKind) => {
    setError(null);
    setResult(null);
    setHistory({ loading: false, error: null, items: null });
    setActive(kind);
  };

  const submitAction = async (kind: ActionKind, form: HTMLFormElement) => {
    const def = ACTION_DEFS[kind];
    const data = new FormData(form);
    const body: Record<string, string> = {
      commandType: def.commandType,
      requestKey: props.requestKeys[kind],
      csrfToken: props.csrf.tokens[kind],
      actionNonce: props.csrf.actionNonce,
    };
    if (kind === "reject") {
      const reason = String(data.get("reason") ?? "").trim();
      if (reason.length > 0) body.reason = reason;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/reports/${encodeURIComponent(props.reportKey)}/command`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        const payload = (await response.json()) as CommandResult;
        setResult(payload);
        window.setTimeout(() => {
          closeDialog();
          router.refresh();
        }, 2000);
        return;
      }
      if (response.status === 403 || response.status === 429) {
        let message = "The action was rejected.";
        try {
          const payload: unknown = await response.json();
          if (
            typeof payload === "object" &&
            payload !== null &&
            typeof (payload as { message?: unknown }).message === "string"
          ) {
            message = (payload as { message: string }).message;
          }
        } catch {
          // Keep the generic safe message.
        }
        setError(message);
        return;
      }
      setError("Action could not be recorded. No change was made.");
    } catch {
      setError("Action could not be recorded. No change was made.");
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    setHistory({ loading: true, error: null, items: null });
    try {
      const response = await fetch(`/reports/${encodeURIComponent(props.reportKey)}/commands`, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) {
        setHistory({ loading: false, error: "Command history is temporarily unavailable.", items: null });
        return;
      }
      const payload = (await response.json()) as { commands?: HistoryItem[] };
      setHistory({ loading: false, error: null, items: Array.isArray(payload.commands) ? payload.commands : [] });
    } catch {
      setHistory({ loading: false, error: "Command history is temporarily unavailable.", items: null });
    }
  };

  const visibleKinds = (Object.keys(ACTION_DEFS) as ActionKind[]).filter(
    (kind) => props.actions[kind],
  );
  if (visibleKinds.length === 0) return null;

  return (
    <div className="report-action-bar">
      <p className="ops-block-label">Report actions</p>
      <div className="report-action-buttons">
        {visibleKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            className={`ops-btn ${ACTION_DEFS[kind].variant === "danger" ? "ops-btn-danger" : ""}`}
            onClick={() => openDialog(kind)}
          >
            {ACTION_DEFS[kind].buttonLabel}
          </button>
        ))}
      </div>

      {visibleKinds.map((kind) => {
        const def = ACTION_DEFS[kind];
        const titleId = `${uid}-${kind}-title`;
        return (
          <dialog
            key={kind}
            ref={(node) => { dialogRefs.current[kind] = node; }}
            className="ops-dialog"
            aria-labelledby={titleId}
            onClose={resetDialogState}
          >
            <h3 id={titleId}>{def.title}</h3>
            <dl className="ops-def-list ops-dialog-summary">
              <div><dt>Client</dt><dd>{props.clientDisplayName}</dd></div>
              <div><dt>Report month</dt><dd>{monthLabel(props.reportMonth)}</dd></div>
              <div><dt>Document status</dt><dd>{props.documentStatus ?? "NO DATA"}</dd></div>
              <div><dt>Action</dt><dd>{def.buttonLabel}</dd></div>
            </dl>
            {def.showsRecipientPolicy ? (
              <p className="ops-dialog-note">
                The report is sent to the fixed recipient policy identity{" "}
                <code>cavetta-monthly-report</code>.
              </p>
            ) : null}
            {result ? (
              <div className="ops-dialog-result">
                <p className="auth-message success" role="status">{friendlyResult(result)}</p>
                {history.loading ? <p className="ops-sub">Loading history…</p> : null}
                {history.error ? <p className="auth-message error" role="alert">{history.error}</p> : null}
                {history.items ? (
                  <ul className="ops-command-history">
                    {history.items.length === 0 ? (
                      <li className="ops-muted">No commands recorded yet.</li>
                    ) : (
                      history.items.map((item, index) => (
                        <li key={`${item.commandType}-${item.requestedAt}-${index}`}>
                          <span>{item.commandType.replaceAll("_", " ")}</span>
                          <span>{friendlyCommandStatus(item)}</span>
                          <time dateTime={item.requestedAt}>
                            {new Date(item.requestedAt).toLocaleString()}
                          </time>
                        </li>
                      ))
                    )}
                  </ul>
                ) : (
                  <button type="button" className="ops-link ops-link-button" onClick={loadHistory} disabled={history.loading}>
                    View history
                  </button>
                )}
                <div className="ops-dialog-actions">
                  <button type="button" className="ops-btn" onClick={closeDialog}>Close</button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitAction(kind, event.currentTarget);
                }}
              >
                <fieldset disabled={busy} className="ops-dialog-fields">
                  {def.requiresRepeatAck ? (
                    <label className="ops-check">
                      <input type="checkbox" name="repeatAck" required />
                      <span>I understand this may send the report once more</span>
                    </label>
                  ) : null}
                  {kind === "reject" ? (
                    <label>
                      Reason (optional)
                      <textarea
                        name="reason"
                        rows={3}
                        maxLength={300}
                        placeholder="Stored privately — never shown in the portal."
                        onInput={(event) => {
                          const counter = event.currentTarget
                            .closest("form")
                            ?.querySelector<HTMLElement>("[data-reason-counter]");
                          if (counter) {
                            counter.textContent = `${event.currentTarget.value.length}/300`;
                          }
                        }}
                      />
                      <span className="ops-sub" data-reason-counter>0/300</span>
                      <span className="ops-sub">Stored privately and never shown in the portal.</span>
                    </label>
                  ) : null}
                  {error ? <p className="auth-message error" role="alert">{error}</p> : null}
                  <div className="ops-dialog-actions">
                    <button type="submit" className={`ops-btn ${def.variant === "danger" ? "ops-btn-danger" : ""}`} disabled={busy}>
                      {busy ? "Recording…" : def.confirmLabel}
                    </button>
                    <button type="button" className="ops-btn ops-btn-ghost" onClick={closeDialog} disabled={busy}>
                      Cancel
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
          </dialog>
        );
      })}
    </div>
  );
}
