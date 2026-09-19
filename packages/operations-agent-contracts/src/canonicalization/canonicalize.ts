import { createHash } from 'node:crypto';

/**
 * Deterministic canonicalization of n8n workflow exports.
 *
 * Purpose: two exports of the *same* workflow must produce byte-identical
 * canonical JSON (and therefore the same SHA-256 hash) no matter how the
 * export file was ordered or which volatile identifiers the server stamped
 * on it. Only behavior-bearing content is retained.
 *
 * Volatile / UI / server fields removed:
 *   - workflow: `id`, `createdAt`, `updatedAt`, `versionId`, `meta`
 *     (instance ids), `staticData`, `pinData`, `tags`, `shared`,
 *     `triggerCount`, and the `active` flag (active state is compared
 *     separately by the drift comparator, not by the semantic hash).
 *   - node: `id`, `position`, `webhookId`, plus any field outside the
 *     behavior-bearing allowlist.
 *   - parameters: recursive; any `notice` key (n8n UI hint text) is dropped.
 *
 * Credentials: every node `credentials` map is reduced to the credential
 * TYPE only, e.g. `{ "httpHeaderAuth": {} }`. Credential `id`, `name` and
 * any other identity/value fields are deleted. The credential *type* is
 * behavior-bearing (a node wired to a GitHub credential behaves
 * differently from one without), so the type key is retained with an
 * empty object as its value. This is the single documented credential
 * behavior: type-only, never identity or secret material.
 *
 * Settings: `settings.timezone` is retained verbatim. The Error Workflow
 * setting is reduced to a presence marker (`errorWorkflowAttached: true`)
 * because the referenced workflow id is instance-volatile; error-workflow
 * *identity* is validated by the drift comparator, not the semantic hash.
 *
 * Ordering: nodes are sorted by their canonical serialization and each
 * connection output array is sorted, so file order never affects the hash.
 */

/** Top-level export keys that are volatile or identity-bearing and dropped. */
const VOLATILE_WORKFLOW_KEYS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'versionId',
  'meta',
  'staticData',
  'pinData',
  'tags',
  'shared',
  'triggerCount',
  'active',
]);

/** Node fields that carry execution behavior and are retained. */
const NODE_BEHAVIOR_KEYS = new Set([
  'name',
  'type',
  'typeVersion',
  'parameters',
  'disabled',
  'continueOnFail',
  'retryOnFail',
  'maxTries',
  'waitBetweenTries',
  'notesInFlow',
  'alwaysOutputData',
  'executeOnce',
]);

/** Settings keys retained verbatim (all others dropped). */
const SETTINGS_ALLOWLIST = new Set([
  'timezone',
  'executionOrder',
  'saveDataErrorExecution',
  'saveDataSuccessExecution',
  'saveManualExecutions',
  'saveExecutionProgress',
  'callerPolicy',
  'errorWorkflowActive',
]);

/** Canonical shape is a plain JSON object; we keep the type structural. */
export type CanonicalWorkflow = Record<string, unknown>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Recursively drop volatile parameter fields (n8n `notice` UI hints). */
function canonicalizeParameters(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeParameters(entry));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      if (key === 'notice') continue;
      out[key] = canonicalizeParameters(entry);
    }
    return out;
  }
  return value;
}

/**
 * Reduce a node `credentials` map to credential types only:
 * `{ githubApi: { id, name } }` becomes `{ githubApi: {} }`.
 * Returns undefined when there is nothing to retain.
 */
function canonicalizeCredentials(credentials: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(credentials)) return undefined;
  const out: Record<string, unknown> = {};
  for (const type of Object.keys(credentials).sort()) {
    out[type] = {};
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function canonicalizeNode(node: unknown): unknown {
  if (!isPlainObject(node)) return node;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(node).sort()) {
    if (!NODE_BEHAVIOR_KEYS.has(key)) continue;
    if (key === 'parameters') {
      out[key] = canonicalizeParameters(node[key]);
    } else {
      out[key] = node[key];
    }
  }
  const credentials = canonicalizeCredentials(node.credentials);
  if (credentials) out.credentials = credentials;
  return out;
}

/**
 * Normalize connections: keep the object shape (source node -> output type
 * -> output index -> connection refs), but sort each output array so that
 * connection order in the export file does not affect the hash. Output
 * *indices* are behavior-bearing and are preserved.
 */
function canonicalizeConnections(connections: unknown): unknown {
  if (!isPlainObject(connections)) return connections;
  const out: Record<string, unknown> = {};
  for (const [sourceNode, outputs] of Object.entries(connections)) {
    if (!isPlainObject(outputs)) {
      out[sourceNode] = outputs;
      continue;
    }
    const canonicalOutputs: Record<string, unknown> = {};
    for (const [outputType, indexedConnections] of Object.entries(outputs)) {
      if (!Array.isArray(indexedConnections)) {
        canonicalOutputs[outputType] = indexedConnections;
        continue;
      }
      canonicalOutputs[outputType] = indexedConnections.map((outputSlot) => {
        if (!Array.isArray(outputSlot)) return outputSlot;
        return [...outputSlot]
          .map((ref) => (isPlainObject(ref) ? sortKeysDeep(ref) : ref))
          .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
      });
    }
    out[sourceNode] = canonicalOutputs;
  }
  return out;
}

function canonicalizeSettings(settings: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(settings)) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(settings).sort()) {
    if (SETTINGS_ALLOWLIST.has(key)) out[key] = settings[key];
  }
  // Error Workflow: keep only the presence marker; the referenced workflow
  // id is instance-volatile and is validated by the drift comparator.
  if (settings.errorWorkflow !== undefined && settings.errorWorkflow !== null && settings.errorWorkflow !== '') {
    out.errorWorkflowAttached = true;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Key-sorted deep copy used as the basis for stable serialization. */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortKeysDeep(entry));
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeysDeep(value[key]);
    }
    return out;
  }
  return value;
}

/**
 * JSON.stringify with object keys sorted recursively at every level.
 * Produces identical output for semantically identical values regardless
 * of input key order.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/**
 * Canonicalize an n8n workflow export. Throws TypeError when the input is
 * not a plain object.
 */
export function canonicalizeWorkflow(exportJson: unknown): CanonicalWorkflow {
  if (!isPlainObject(exportJson)) {
    throw new TypeError('canonicalizeWorkflow expects a workflow export object');
  }

  const canonical: Record<string, unknown> = {};

  if (typeof exportJson.name === 'string') canonical.name = exportJson.name;

  if (Array.isArray(exportJson.nodes)) {
    const nodes = exportJson.nodes.map((node) => canonicalizeNode(node));
    nodes.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
    canonical.nodes = nodes;
  }

  if (exportJson.connections !== undefined) {
    canonical.connections = canonicalizeConnections(exportJson.connections);
  }

  const settings = canonicalizeSettings(exportJson.settings);
  if (settings) canonical.settings = settings;

  // Retain any remaining non-volatile top-level keys verbatim (future-proof).
  for (const key of Object.keys(exportJson).sort()) {
    if (key in canonical) continue;
    if (VOLATILE_WORKFLOW_KEYS.has(key)) continue;
    if (['name', 'nodes', 'connections', 'settings'].includes(key)) continue;
    canonical[key] = exportJson[key];
  }

  return sortKeysDeep(canonical) as CanonicalWorkflow;
}

/**
 * SHA-256 (hex, node:crypto) of the stable serialization of a canonical
 * workflow. Pass the result of `canonicalizeWorkflow`. Deterministic:
 * identical canonical forms always hash identically.
 */
export function canonicalHash(canonical: unknown): string {
  return createHash('sha256').update(stableStringify(canonical)).digest('hex');
}
