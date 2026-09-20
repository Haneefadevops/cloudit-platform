/**
 * Binding for the read model's drift port.
 *
 * Pass-through by design, mirroring findingsBinding: the coordinator wires
 * the real drift summary source; otherwise the fail-closed default
 * (state 'unknown', zero counts, no scan timestamp) is kept.
 *
 * Why SyncService is NOT bound here: its scan() path requires a manifest
 * source, a live n8n observation source and a portal catalogue source, all
 * of which are unbound in this phase — requireManifest()/requireLiveSource()/
 * requireCatalogue() throw 'not bound', i.e. SyncService scans already fail
 * closed today. There is also no coordinator-owned persisted drift summary
 * to read between scans. A live drift binding that runs/reads scans is
 * therefore deferred to the coordinator under a later gate; until then the
 * projection reports the explicit fail-closed default rather than stale or
 * fabricated drift state.
 */

import {
  defaultDriftSource,
  type AiMaintenanceReadModelOptions,
} from '../ai/read-model';

export function driftBinding(
  source: AiMaintenanceReadModelOptions['drift'] | undefined,
): AiMaintenanceReadModelOptions['drift'] {
  return source ?? defaultDriftSource();
}
