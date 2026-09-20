import { getRemediationProposals } from "../lib/remediation-api";
import type { RemediationProjection } from "../lib/remediation-types";
import { OperationsApiError } from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { requireOperationsSession } from "../lib/server-session";
import { OperationsErrorState } from "./operations-error-state";
import { ProposalCard } from "./remediation/proposal-cards";

const EXECUTE_NOTHING_COPY =
  "Proposals are generated from a fixed allowlisted runbook mapping. Nothing here executes; repairs stay disabled.";

const pageHeader = (
  <header className="page-header">
    <div>
      <p className="eyebrow">OPERATIONS · REMEDIATION PROPOSALS</p>
      <h1>Remediation proposals</h1>
      <p>Repairs are disabled — this is an execute-nothing proposals view only</p>
    </div>
  </header>
);

function RemediationContent({ projection }: { projection: RemediationProjection }) {
  return (
    <div className="page-wrap">
      {pageHeader}
      <p className="ops-updated">
        Environment {projection.environmentKey} · Generated {formatMaltaTime(projection.generatedAt)}
      </p>
      <article className="ops-card">
        <p className="ops-empty-note">{EXECUTE_NOTHING_COPY}</p>
      </article>
      <section className="ops-client" aria-labelledby="remediation-proposals">
        <h2 id="remediation-proposals" className="ops-client-title">
          Proposals
        </h2>
        {projection.proposals.length === 0 ? (
          <article className="ops-card">
            <p className="ops-empty-note">No remediation proposals have been published yet.</p>
          </article>
        ) : (
          projection.proposals.map((proposal) => (
            <ProposalCard key={proposal.proposalId} proposal={proposal} />
          ))
        )}
      </section>
    </div>
  );
}

export async function RemediationPage() {
  const session = await requireOperationsSession();
  void session;
  const view = await getRemediationProposals();
  if (!view.available || view.projection === null) {
    return (
      <div className="page-wrap">
        {pageHeader}
        <OperationsErrorState
          error={new OperationsApiError(503, "Remediation proposals view is currently unavailable.")}
        />
      </div>
    );
  }
  return <RemediationContent projection={view.projection} />;
}
