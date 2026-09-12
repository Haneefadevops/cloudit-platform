import { TriangleAlert } from "lucide-react";
import { OperationsApiError } from "../lib/operations-api";

export function OperationsErrorState({ error }: { error: unknown }) {
  const statusCode = error instanceof OperationsApiError ? error.statusCode : 500;
  const message = error instanceof OperationsApiError
    ? error.message
    : "Operations evidence is temporarily unavailable.";
  return (
    <section className="ops-error" aria-labelledby="ops-error-title" role="alert">
      <div className="ops-error-icon"><TriangleAlert aria-hidden="true" /></div>
      <div>
        <h2 id="ops-error-title">Operations data unavailable</h2>
        <p>{message}</p>
        <p className="ops-error-meta">Error code {statusCode} · retry by refreshing this page</p>
      </div>
    </section>
  );
}
