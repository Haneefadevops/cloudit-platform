import type { RemediationProposalStatus } from "../../lib/remediation-types";

const pillClass: Record<RemediationProposalStatus, string> = {
  PROPOSED: "amber",
  APPROVED: "green",
  REJECTED: "red",
  EXPIRED: "no-data",
};

export function ProposalStatusPill({ status }: { status: RemediationProposalStatus }) {
  return (
    <span className={`status-pill ${pillClass[status] ?? "no-data"}`}>
      <span />
      {status}
    </span>
  );
}
