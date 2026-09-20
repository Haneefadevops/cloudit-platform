/**
 * Binding for the read model's findings port.
 *
 * Pass-through by design: the coordinator (or Worker A's Phase E adapter)
 * supplies the FindingsSource that owns AI-explained findings. When no
 * source is wired yet, the fail-closed default (empty list) is kept so the
 * read model never throws and never fabricates findings.
 *
 * Why the supervisor is NOT bound here, although it produces "findings":
 * - src/supervisor/evidence-projection.ts exposes SanitizedEvidenceProjection,
 *   an allowlisted INPUT shape for the deterministic rule engine, not a
 *   finding read model; and
 * - SupervisorService.assess() returns the contracts Finding type
 *   (findingId/environmentKey/issueCode/severity/state/summary/evidenceKeys/
 *   firstSeenAt/lastSeenAt), which is structurally incompatible with
 *   AiFindingProjection (findingKey/safeTitle/assessment/confidence/
 *   recommendedRunbook/explainedAt/model). Bridging them would invent
 *   semantics (no explanation timestamp, no model, no assessment health
 *   status), so no mapping is fabricated in this phase. A compatible
 *   findings source is expected from the Phase E AI adapter under the
 *   coordinator's integration gate.
 */

import { defaultFindingsSource, type FindingsSource } from '../ai/read-model';

export function findingsBinding(source: FindingsSource | undefined): FindingsSource {
  return source ?? defaultFindingsSource();
}
