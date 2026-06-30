import { ReactNode } from "react";
import { Loader2, AlertCircle, Inbox } from "lucide-react";

export function LoadingState({
  message = "Loading...",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-error/20 bg-error-subtle px-6 py-12 text-center">
      <AlertCircle className="h-8 w-8 text-error" />
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Inbox className="h-8 w-8 text-muted" />
      <div>
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
