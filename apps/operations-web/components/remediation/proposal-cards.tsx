import type { RemediationProposalView } from "../../lib/remediation-types";
import { formatMaltaTime } from "../../lib/operations-time";
import { ProposalStatusPill } from "./proposal-row";

function ProposalSection({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="ops-block">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="ops-empty-note">None recorded.</p>
      ) : (
        <ul>
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One execute-nothing remediation proposal. Displays the fixed allowlisted
 * issue→runbook mapping only: there is deliberately no approve/reject/execute
 * control anywhere in this card.
 */
export function ProposalCard({ proposal }: { proposal: RemediationProposalView }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>{proposal.runbookKey}</h3>
        <ProposalStatusPill status={proposal.status} />
      </div>
      <p className="ops-sub">Subject {proposal.subjectKey}</p>
      <p className="ops-sub">
        Created <time dateTime={proposal.createdAt}>{formatMaltaTime(proposal.createdAt)}</time>
        {" · "}Expires <time dateTime={proposal.expiresAt}>{formatMaltaTime(proposal.expiresAt)}</time>
      </p>
      <ProposalSection title="Preconditions" items={proposal.preconditions} />
      <div className="ops-block">
        <h4>Expected impact</h4>
        <p>{proposal.expectedImpact}</p>
      </div>
      <ProposalSection title="Verification" items={proposal.verification} />
      <ProposalSection title="Rollback" items={proposal.rollback} />
    </article>
  );
}
