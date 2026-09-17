#!/usr/bin/env node
// Semantic harness for the "CloudIT - Incident Evidence Publisher" n8n
// workflow export.
//
// Run: node infra/n8n/workflows/tests/incident-publisher-harness.mjs
//
// Dependency-free. Extracts the jsCode of the "Build Incident Records" and
// "Validate Records" Code nodes from the workflow JSON and executes them
// with stubs that mimic n8n's Code node:
//   - $input -> { all() } over the input items (Build Incident Records,
//     runOnceForAllItems)
//   - $json  -> the node's input item json (Validate Records,
//     runOnceForEachItem)
//
// The pure mapping is a self-contained `mapEvents(events, now)` function
// inside the Build Incident Records jsCode; the harness strips the node's
// driver `return mapEvents(...)` line, evaluates the remainder, and calls
// the extracted function directly with fixture rows shaped exactly like the
// n8n Data Table "cavetta_maintenance_events" columns.
//
// IMPORT BINDING REQUIREMENTS (manual, on import into n8n):
//   - "Load Maintenance Events": re-bind the Data Table to
//     "cavetta_maintenance_events" (the export keeps an empty dataTableId
//     value with the cached table name, list mode).
//   - "Publish Evidence": re-select the "CloudIT - Publish Operations
//     Evidence" sub-workflow (empty workflowId, list mode). If n8n wipes
//     the two workflow inputs, re-enter:
//       records      = {{ JSON.stringify($json.records) }}   (Allow Any Type)
//       publisherKey = {{ $json.publisherKey }}              (String)

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(here, '..', 'cloudit-incident-evidence-publisher.json');
const collectorPath = join(here, '..', 'cloudit-endpoint-evidence-collector.json');
const workflow = JSON.parse(readFileSync(workflowPath, 'utf8'));
const collector = JSON.parse(readFileSync(collectorPath, 'utf8'));

let failures = 0;
let passes = 0;

function check(label, fn) {
  try {
    fn();
    passes += 1;
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL  ${label}\n      ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertThrows(label, fn, match) {
  check(label, () => {
    let thrown = null;
    try {
      fn();
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== null, 'expected an error, but none was thrown');
    if (match) assert(match.test(thrown.message), `error message mismatch: ${thrown.message}`);
  });
}

// Fixed harness clock — fixture eventAt values are relative to this instant.
const NOW = new Date('2026-09-15T12:00:00.000Z');

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Structural invariants of the export itself
// ---------------------------------------------------------------------------

check('export: workflow is inactive', () => {
  assert(workflow.active === false, `active must be false, got ${workflow.active}`);
});

check('export: no pinData anywhere', () => {
  assert(!('pinData' in workflow), 'workflow-level pinData present');
  for (const node of workflow.nodes) {
    assert(!('pinData' in node), `pinData present on node "${node.name}"`);
  }
});

check('export: seven nodes present with expected names', () => {
  const expected = [
    'Every 15 Minutes',
    'Load Maintenance Events',
    'Build Incident Records',
    'Validate Records',
    'Has Records?',
    'Publish Evidence',
    'Nothing To Publish',
  ];
  assert(workflow.nodes.length === 7, `expected 7 nodes, got ${workflow.nodes.length}`);
  for (const name of expected) {
    assert(workflow.nodes.some((n) => n.name === name), `node "${name}" missing`);
  }
});

check('export: no disabled nodes', () => {
  for (const node of workflow.nodes) {
    assert(node.disabled !== true, `node "${node.name}" is disabled`);
  }
});

check('export: no credentials on any node', () => {
  for (const node of workflow.nodes) {
    assert(!('credentials' in node), `node "${node.name}" carries credentials`);
  }
});

check('export: no email or notification nodes', () => {
  const forbidden = ['n8n-nodes-base.emailSend', 'n8n-nodes-base.smtp'];
  for (const node of workflow.nodes) {
    assert(!forbidden.includes(node.type), `forbidden node type ${node.type}`);
  }
});

check('export: schedule is every 15 minutes', () => {
  const trigger = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.scheduleTrigger');
  assert(trigger, 'scheduleTrigger node missing');
  assert(
    trigger.parameters.rule.interval[0].expression === '*/15 * * * *',
    `bad cron: ${trigger.parameters.rule.interval[0].expression}`,
  );
});

check('export: settings are executionOrder v1 with binaryMode separate', () => {
  assert(workflow.settings?.executionOrder === 'v1', 'executionOrder must be v1');
  assert(workflow.settings?.binaryMode === 'separate', 'binaryMode must be separate');
});

check('export: Publish Evidence params match the endpoint collector exactly', () => {
  const publish = workflow.nodes.find((n) => n.name === 'Publish Evidence');
  const reference = collector.nodes.find((n) => n.name === 'Publish Evidence');
  assert(publish, 'Publish Evidence node missing');
  assert(reference, 'reference Publish Evidence node missing in collector export');
  assert(publish.type === reference.type, `type mismatch: ${publish.type}`);
  assert(publish.typeVersion === reference.typeVersion, `typeVersion mismatch: ${publish.typeVersion}`);
  assert(
    deepEqual(publish.parameters, reference.parameters),
    'Publish Evidence parameters differ from the endpoint collector',
  );
});

check('export: Load Maintenance Events targets cavetta_maintenance_events (bound on import)', () => {
  const load = workflow.nodes.find((n) => n.name === 'Load Maintenance Events');
  assert(load, 'Load Maintenance Events node missing');
  assert(load.parameters.dataTableId?.__rl === true, 'dataTableId must use __rl list mode');
  assert(load.parameters.dataTableId?.value === '', 'dataTableId value must be empty (bound on import)');
  assert(
    load.parameters.dataTableId?.cachedResultName === 'cavetta_maintenance_events',
    'cachedResultName must be cavetta_maintenance_events',
  );
  assert(load.parameters.limit === 500, `limit must be 500, got ${load.parameters.limit}`);
});

// ---------------------------------------------------------------------------
// Extract Code node snippets and build n8n-style runners
// ---------------------------------------------------------------------------

const nodeByName = (name) => {
  const node = workflow.nodes.find((n) => n.name === name);
  assert(node, `node "${name}" not found in export`);
  return node;
};

const buildCode = nodeByName('Build Incident Records').parameters.jsCode;
const validateCode = nodeByName('Validate Records').parameters.jsCode;

// The node's jsCode ends with a driver `return mapEvents(...)` line; strip
// it so the remainder can be evaluated and mapEvents extracted.
function extractMapEvents() {
  const stripped = buildCode.replace(/return mapEvents\([\s\S]*?\);\s*$/, 'return mapEvents;');
  assert(stripped !== buildCode, 'could not locate the mapEvents driver return in Build Incident Records');
  const factory = new Function('$input', '"use strict"; ' + stripped);
  const mapEvents = factory({ all: () => [] });
  assert(typeof mapEvents === 'function', 'mapEvents is not a function');
  return mapEvents;
}

const mapEvents = extractMapEvents();

// Runs the mapping against raw maintenance-event rows (data table columns).
function runMap(rows, now = NOW) {
  const result = mapEvents(rows, now);
  assert(typeof result === 'object' && result !== null, 'mapEvents must return an object');
  assert(Array.isArray(result.records), 'mapEvents must return a records array');
  return result;
}

// Runs the Validate Records node (runOnceForEachItem) against a batch.
function runValidate(batch) {
  const fn = new Function('$json', '"use strict"; ' + validateCode);
  return fn(batch);
}

// Builds one fixture maintenance-event row with the exact column shape
// written by the incident monitor's "Store Maintenance Event" node.
function row(overrides = {}) {
  return {
    executionId: 'exec-harness-1',
    alertType: 'CONFIRMED_DOWN',
    severity: 'critical',
    monitorId: 1,
    monitorName: 'Cavetta Home',
    url: 'https://cavetta.mt/',
    eventAt: '2026-09-15T11:00:00.000Z',
    checkedAt: '2026-09-15T11:02:00.000Z',
    detail: 'HTTP 503 Service Unavailable',
    responseTimeMs: 1200,
    productionChanged: false,
    actionRequired: 'Manual investigation required',
    ...overrides,
  };
}

const STATUSES = ['GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN'];
const SEVERITIES = ['info', 'warning', 'critical', 'none'];
const ENVELOPE_KEYS = ['contractVersion', 'recordType', 'idempotencyKey', 'environmentKey', 'sourceSystem', 'observedAt', 'publishedAt', 'freshUntil', 'status', 'severity', 'correlationKey', 'payload'];

// ---------------------------------------------------------------------------
// Mapping cases
// ---------------------------------------------------------------------------

check('map: CONFIRMED_DOWN with HTTP 503 detail -> open / http_5xx / RED', () => {
  const { records } = runMap([row()]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  const r = records[0];
  assert(r.payload.state === 'open', `state mismatch: ${r.payload.state}`);
  assert(r.payload.failureCategory === 'http_5xx', `failureCategory mismatch: ${r.payload.failureCategory}`);
  assert(r.payload.severity === 'critical', `payload severity mismatch: ${r.payload.severity}`);
  assert(r.severity === 'critical', `envelope severity mismatch: ${r.severity}`);
  assert(r.status === 'RED', `status mismatch: ${r.status}`);
  assert(r.payload.occurrenceCount === 1, 'occurrenceCount must be 1');
  assert(r.payload.startedAt === '2026-09-15T11:00:00.000Z', 'startedAt must be eventAt');
  assert(r.payload.confirmedAt === '2026-09-15T11:02:00.000Z', 'confirmedAt must be checkedAt');
  assert(r.payload.incidentKey === 'cavetta-uptime-1', `incidentKey mismatch: ${r.payload.incidentKey}`);
  assert(r.payload.serviceKey === 'cavetta-uptime-1', 'serviceKey must equal incidentKey');
  assert(r.payload.safeSummary === 'Cavetta Home confirmed down (http_5xx)', `safeSummary mismatch: ${r.payload.safeSummary}`);
});

check('map: ENOTFOUND connection failure detail -> dns', () => {
  const { records } = runMap([row({ detail: 'getaddrinfo ENOTFOUND cavetta.mt' })]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  assert(records[0].payload.failureCategory === 'dns', `failureCategory mismatch: ${records[0].payload.failureCategory}`);
});

check('map: timeout detail -> timeout', () => {
  const { records } = runMap([row({ detail: 'connect ETIMEDOUT 203.0.113.10:443' })]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  assert(records[0].payload.failureCategory === 'timeout', `failureCategory mismatch: ${records[0].payload.failureCategory}`);
});

check('map: unclassifiable detail -> unknown_sanitized', () => {
  const { records } = runMap([row({ detail: 'something odd happened' })]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  assert(records[0].payload.failureCategory === 'unknown_sanitized', `failureCategory mismatch: ${records[0].payload.failureCategory}`);
});

check('map: RECOVERED -> recovered / info, no failureCategory key, occurrenceCount 0', () => {
  const { records } = runMap([
    row({ alertType: 'RECOVERED', severity: 'information', detail: 'Recovered after outage', eventAt: '2026-09-15T11:30:00.000Z', checkedAt: '2026-09-15T11:30:00.000Z', actionRequired: 'None' }),
  ]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  const p = records[0].payload;
  assert(p.state === 'recovered', `state mismatch: ${p.state}`);
  assert(p.severity === 'info', `severity mismatch: ${p.severity}`);
  assert(records[0].status === 'GREEN', `status mismatch: ${records[0].status}`);
  assert(!('failureCategory' in p), 'RECOVERED payload must omit failureCategory entirely');
  assert(p.occurrenceCount === 0, 'occurrenceCount must be 0 for recoveries');
  assert(p.recoveredAt === '2026-09-15T11:30:00.000Z', 'recoveredAt must be eventAt');
  assert(p.safeSummary === 'Cavetta Home recovered', `safeSummary mismatch: ${p.safeSummary}`);
  assert(p.safeAction === 'None', `safeAction mismatch: ${p.safeAction}`);
});

check('map: RECOVERED_DURING_CONFIRMATION -> recovered with derived failureCategory', () => {
  const { records } = runMap([
    row({ alertType: 'RECOVERED_DURING_CONFIRMATION', severity: 'information', detail: 'Recovered with HTTP 200 after confirmation attempt', eventAt: '2026-09-15T11:40:00.000Z', checkedAt: '2026-09-15T11:42:00.000Z', actionRequired: 'None' }),
  ]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  const p = records[0].payload;
  assert(p.state === 'recovered', `state mismatch: ${p.state}`);
  assert(p.failureCategory === 'http_4xx' || p.failureCategory === 'unknown_sanitized', `failureCategory mismatch: ${p.failureCategory}`);
  assert(p.startedAt === '2026-09-15T11:40:00.000Z', 'startedAt must be eventAt');
  assert(p.recoveredAt === '2026-09-15T11:42:00.000Z', 'recoveredAt must be checkedAt');
  assert(p.occurrenceCount === 0, 'occurrenceCount must be 0');
});

check('map: REJECTED_MONITOR_EVENT rows are skipped entirely', () => {
  const { records } = runMap([row({ alertType: 'REJECTED_MONITOR_EVENT', severity: 'warning' })]);
  assert(records.length === 0, `expected 0 records, got ${records.length}`);
});

check('map: unknown alertType (incl. TEST) is skipped defensively', () => {
  const { records } = runMap([row({ alertType: 'TEST' }), row({ alertType: 'DOWN' })]);
  assert(records.length === 0, `expected 0 records, got ${records.length}`);
});

check('map: unknown monitor ID is skipped defensively', () => {
  const { records } = runMap([row({ monitorId: 99 })]);
  assert(records.length === 0, `expected 0 records, got ${records.length}`);
});

check('map: monitor 4 omits endpointKey; registered monitors include theirs', () => {
  const { records } = runMap([
    row({ monitorId: 4, monitorName: 'Cavetta Home Contacts', url: 'https://cavetta.mt/contact' }),
    row({ monitorId: 5, monitorName: 'Cavetta Home Robot', url: 'https://cavetta.mt/robots.txt' }),
  ]);
  assert(records.length === 2, `expected 2 records, got ${records.length}`);
  const byMonitor = Object.fromEntries(records.map((r) => [r.payload.incidentKey, r.payload]));
  assert(!('endpointKey' in byMonitor['cavetta-uptime-4']), 'monitor 4 payload must omit endpointKey');
  assert(byMonitor['cavetta-uptime-5'].endpointKey === 'cavetta.robots', 'monitor 5 endpointKey mismatch');
});

check('map: events older than the 48-hour window are dropped', () => {
  const { records } = runMap([row({ eventAt: '2026-09-10T11:00:00.000Z', checkedAt: '2026-09-10T11:02:00.000Z' })]);
  assert(records.length === 0, `expected 0 records, got ${records.length}`);
});

check('map: empty input is valid and returns an empty batch', () => {
  const result = runMap([]);
  assert(result.records.length === 0, 'records must be empty');
  assert(result.publisherKey === 'cavetta-production-n8n', `publisherKey mismatch: ${result.publisherKey}`);
});

check('map: idempotencyKey is stable, <=160 chars, and safe charset', () => {
  const rows = [row()];
  const first = runMap(rows).records[0].idempotencyKey;
  const second = runMap(rows).records[0].idempotencyKey;
  assert(first === second, `idempotencyKey not stable: ${first} vs ${second}`);
  assert(first.length <= 160, `idempotencyKey too long: ${first.length}`);
  assert(/^[a-zA-Z0-9_.-]+$/.test(first), `idempotencyKey has unsafe chars: ${first}`);
  // ISO colons must be sanitized out of the key.
  assert(!first.includes(':'), `idempotencyKey contains unsanitized chars: ${first}`);
});

check('map: idempotencyKey embeds monitor, alertType, and eventAt', () => {
  const { records } = runMap([row({ monitorId: 2, alertType: 'RECOVERED', eventAt: '2026-09-15T09:15:00.000Z', checkedAt: '2026-09-15T09:15:00.000Z' })]);
  assert(records.length === 1, `expected 1 record, got ${records.length}`);
  assert(
    records[0].idempotencyKey === 'incident-cavetta-uptime-2-RECOVERED-2026-09-15T091500.000Z',
    `idempotencyKey mismatch: ${records[0].idempotencyKey}`,
  );
});

check('map: records are sorted by eventAt ascending regardless of input order', () => {
  const later = row({ eventAt: '2026-09-15T11:10:00.000Z', checkedAt: '2026-09-15T11:12:00.000Z' });
  const earlier = row({ alertType: 'RECOVERED', severity: 'information', eventAt: '2026-09-15T11:05:00.000Z', checkedAt: '2026-09-15T11:05:00.000Z', actionRequired: 'None' });
  const { records } = runMap([later, earlier]);
  assert(records.length === 2, `expected 2 records, got ${records.length}`);
  assert(records[0].payload.state === 'recovered', 'the T+5 recovery must sort before the T+10 down');
  assert(records[1].payload.state === 'open', 'the T+10 down must sort last so it applies last');
});

check('map: every envelope is complete and uses only allowed enum values', () => {
  const { records } = runMap([
    row(),
    row({ monitorId: 2, monitorName: 'Cavetta Home Properties', alertType: 'RECOVERED', severity: 'information', eventAt: '2026-09-15T10:00:00.000Z', checkedAt: '2026-09-15T10:00:00.000Z', actionRequired: 'None' }),
    row({ monitorId: 3, monitorName: 'Cavetta Home Sitemap', alertType: 'RECOVERED_DURING_CONFIRMATION', severity: 'information', detail: 'timeout during confirmation', eventAt: '2026-09-15T10:30:00.000Z', checkedAt: '2026-09-15T10:32:00.000Z', actionRequired: 'None' }),
  ]);
  assert(records.length === 3, `expected 3 records, got ${records.length}`);
  for (const r of records) {
    for (const k of ENVELOPE_KEYS) {
      assert(k in r, `envelope missing key ${k}`);
    }
    assert(r.contractVersion === '1.0', 'contractVersion must be 1.0');
    assert(r.recordType === 'incident', 'recordType must be incident');
    assert(r.environmentKey === 'production', 'environmentKey must be production');
    assert(r.sourceSystem === 'n8n', 'sourceSystem must be n8n');
    assert(STATUSES.includes(r.status), `status not allowed: ${r.status}`);
    assert(SEVERITIES.includes(r.severity), `severity not allowed: ${r.severity}`);
    assert(r.correlationKey === null, 'correlationKey must be null');
    for (const k of ['observedAt', 'publishedAt', 'freshUntil']) {
      assert(!Number.isNaN(Date.parse(r[k])), `${k} is not an ISO timestamp: ${r[k]}`);
    }
    const freshMs = Date.parse(r.freshUntil) - Date.parse(r.publishedAt);
    assert(Math.abs(freshMs - 24 * 60 * 60 * 1000) < 2000, `freshUntil must be publishedAt + 24h, got ${freshMs}ms`);
  }
});

check('map: safeSummary never contains a URL scheme', () => {
  const { records } = runMap([
    row({ detail: 'HTTP 503 from https://cavetta.mt/ deep endpoint' }),
    row({ monitorId: 5, monitorName: 'Cavetta Home Robot', url: 'https://cavetta.mt/robots.txt', detail: 'http://internal check failed' }),
  ]);
  assert(records.length === 2, `expected 2 records, got ${records.length}`);
  for (const r of records) {
    assert(!r.payload.safeSummary.includes('http://'), `safeSummary leaks a URL: ${r.payload.safeSummary}`);
    assert(!r.payload.safeSummary.includes('https://'), `safeSummary leaks a URL: ${r.payload.safeSummary}`);
    assert(!r.payload.safeAction.includes('://'), `safeAction leaks a URL: ${r.payload.safeAction}`);
  }
});

// ---------------------------------------------------------------------------
// Validate Records cases
// ---------------------------------------------------------------------------

check('validate: a full mapped batch passes untouched', () => {
  const batch = runMap([
    row(),
    row({ monitorId: 2, monitorName: 'Cavetta Home Properties', alertType: 'RECOVERED', severity: 'information', eventAt: '2026-09-15T10:00:00.000Z', checkedAt: '2026-09-15T10:00:00.000Z', actionRequired: 'None' }),
  ]);
  const out = runValidate(batch);
  assert(out === batch || deepEqual(out, batch), 'validate must return the batch unchanged');
});

check('validate: empty batch is flagged skipped instead of published', () => {
  const out = runValidate({ records: [], publisherKey: 'cavetta-production-n8n' });
  assert(out.skipped === true, 'empty batch must set skipped:true');
  assert(Array.isArray(out.records) && out.records.length === 0, 'records must stay empty');
});

assertThrows('validate: payload key outside the allowlist throws and lists it', () => {
  const batch = runMap([row()]);
  batch.records[0].payload.evidenceUrl = 'https://cavetta.mt/';
  runValidate(batch);
}, /outside the insert_incident allowlist.*evidenceUrl/);

assertThrows('validate: invalid state enum throws', () => {
  const batch = runMap([row()]);
  batch.records[0].payload.state = 'acknowledged';
  runValidate(batch);
}, /invalid payload state/);

assertThrows('validate: invalid failureCategory enum throws', () => {
  const batch = runMap([row()]);
  batch.records[0].payload.failureCategory = 'not_a_category';
  runValidate(batch);
}, /invalid failureCategory/);

assertThrows('validate: missing required payload field throws', () => {
  const batch = runMap([row()]);
  delete batch.records[0].payload.startedAt;
  runValidate(batch);
}, /missing required payload field "startedAt"/);

assertThrows('validate: URL-bearing safeSummary throws', () => {
  const batch = runMap([row()]);
  batch.records[0].payload.safeSummary = 'down, see https://cavetta.mt/';
  runValidate(batch);
}, /safeSummary/);

// ---------------------------------------------------------------------------

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
