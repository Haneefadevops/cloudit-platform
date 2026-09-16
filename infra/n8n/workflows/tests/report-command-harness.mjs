#!/usr/bin/env node
// Semantic harness for the "CloudIT - Guarded Report Command" n8n workflow export.
//
// Run: node infra/n8n/workflows/tests/report-command-harness.mjs
//
// Dependency-free. Extracts the JS of the "Validate Signed Command" and
// "Guard Authoritative Row" Code nodes from the workflow JSON and executes
// them with stubs that mimic n8n's Code node (runOnceForAllItems):
//   - $env     -> environment values (OPERATIONS_REPORT_COMMAND_SECRET)
//   - $json    -> the node's input item json
//   - $input   -> { all(), first(), item } over the input items
//   - $        -> (nodeName) => ({ first(), all() }) cross-node references,
//                 mirroring n8n's $('Node Name') accessor
//
// The webhook item json mimics n8n's Webhook node output exactly:
//   { headers, params, query, body } where body is the parsed request body.

import { createHash, createHmac, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// n8n runs Code nodes with NODE_FUNCTION_ALLOW_BUILTIN=crypto, so `require`
// is available there; the wrapper below injects an equivalent into scope.
const nodeRequire = createRequire(import.meta.url);

const here = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(here, '..', 'cloudit-guarded-report-command.json');
const workflow = JSON.parse(readFileSync(workflowPath, 'utf8'));

const TEST_SECRET = 'harness-report-command-secret-0123456789abcd';

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

function assertThrowsDenied(label, fn) {
  check(label, () => {
    let thrown = null;
    try {
      fn();
    } catch (error) {
      thrown = error;
    }
    assert(thrown !== null, 'expected an error, but none was thrown');
    assert(thrown.message === 'Report command denied', `expected generic denial, got: ${thrown.message}`);
  });
}

// ---------------------------------------------------------------------------
// Structural invariants of the export itself
// ---------------------------------------------------------------------------

check('export: workflow is inactive', () => {
  assert(workflow.active === false, `active must be false, got ${workflow.active}`);
});

check('export: no email node', () => {
  assert(
    !workflow.nodes.some((n) => n.type === 'n8n-nodes-base.emailSend'),
    'found an emailSend node',
  );
});

check('export: no S3 node', () => {
  assert(!workflow.nodes.some((n) => n.type === 'n8n-nodes-base.s3'), 'found an S3 node');
});

check('export: no schedule trigger', () => {
  assert(
    !workflow.nodes.some((n) => n.type === 'n8n-nodes-base.scheduleTrigger'),
    'found a scheduleTrigger node',
  );
});

check('export: webhook path is cloudit-report-command', () => {
  const webhook = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  assert(webhook, 'webhook node missing');
  assert(webhook.parameters.path === 'cloudit-report-command', `bad path: ${webhook.parameters.path}`);
  assert(webhook.parameters.authentication === 'headerAuth', 'webhook must use headerAuth');
});

check('export: CloudIT Report Command credential present', () => {
  const webhook = workflow.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  assert(
    webhook.credentials?.httpHeaderAuth?.name === 'CloudIT Report Command',
    'webhook is missing the CloudIT Report Command credential',
  );
});

check('export: no pinData anywhere', () => {
  assert(!('pinData' in workflow) || workflow.pinData == null, 'workflow-level pinData present');
  for (const node of workflow.nodes) {
    assert(!('pinData' in node), `pinData present on node "${node.name}"`);
  }
});

// ---------------------------------------------------------------------------
// Extract Code node snippets and build n8n-style runners
// ---------------------------------------------------------------------------

const nodeByName = (name) => {
  const node = workflow.nodes.find((n) => n.name === name);
  assert(node, `node "${name}" not found in export`);
  return node;
};

const validateCode = nodeByName('Validate Signed Command').parameters.jsCode;
const guardCode = nodeByName('Guard Authoritative Row').parameters.jsCode;

function makeStubs(itemJson, items, nodeOutputs) {
  const list = items ?? [{ json: itemJson }];
  const $input = {
    all: () => list,
    first: () => list[0] ?? { json: {} },
    item: (list[0] ?? { json: {} }).json,
  };
  const $ = (name) => {
    if (!(name in nodeOutputs)) throw new Error(`$ stub has no output for node "${name}"`);
    const outItems = nodeOutputs[name].map((json) => ({ json }));
    return { all: () => outItems, first: () => outItems[0] };
  };
  return { $input, $ };
}

// Runs the validation node against a webhook envelope. Returns its item json.
function runValidate(envelope, env = { OPERATIONS_REPORT_COMMAND_SECRET: TEST_SECRET }) {
  const itemJson = { headers: {}, params: {}, query: {}, body: envelope };
  const { $input, $ } = makeStubs(itemJson);
  const fn = new Function('require', '$env', '$json', '$input', '$', '"use strict"; ' + validateCode);
  const result = fn(nodeRequire, env, itemJson, $input, $);
  return result[0].json;
}

// Runs the guard node against data table rows plus the validation output.
function runGuard(rows, validationJson) {
  const items = rows.map((json) => ({ json }));
  const { $input, $ } = makeStubs({}, items, { 'Validate Signed Command': [validationJson] });
  const fn = new Function('require', '$env', '$json', '$input', '$', '"use strict"; ' + guardCode);
  const result = fn(nodeRequire, {}, {}, $input, $);
  return result[0].json;
}

// ---------------------------------------------------------------------------
// Command builders (mirror platform-api's report-command-payload.util.ts)
// ---------------------------------------------------------------------------

const nowSec = () => Math.floor(Date.now() / 1000);
const hex = (bytes) => randomBytes(bytes).toString('hex');

function normalizeReason(input) {
  return input.normalize('NFC').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().replace(/\s+/g, ' ');
}

function canonicalOf(p) {
  return [
    'v1',
    p.commandKey,
    p.commandType,
    p.reportKey,
    p.clientKey,
    String(p.expectedRowVersion),
    p.expectedState,
    p.nonce,
    String(p.issuedAt),
    String(p.expiresAt),
    p.correlationId,
    p.recipientPolicyKey,
    p.reasonDigest,
  ].join('\n');
}

const sign = (canonical) => createHmac('sha256', TEST_SECRET).update(canonical).digest('hex');

// Builds a wire envelope { payload, signature, reason? }. `mutate` runs after
// the payload is assembled but before signing, so signatures stay valid.
function buildCommand({
  commandType = 'APPROVE_AND_SEND',
  reportKey = 'cavetta.monthly_maintenance.2026-09',
  expectedRowVersion = 1,
  expectedState = commandType === 'RETRY_SEND' ? 'SEND_FAILED' : 'DRAFT',
  reason = undefined,
  mutate = null,
  omitReason = false,
} = {}) {
  const now = nowSec();
  const normalized = reason === undefined ? null : normalizeReason(reason);
  const payload = {
    version: 'v1',
    commandKey: hex(16),
    commandType,
    reportKey,
    clientKey: 'cavetta',
    expectedRowVersion,
    expectedState,
    nonce: hex(32),
    issuedAt: now,
    expiresAt: now + 120,
    correlationId: hex(16),
    recipientPolicyKey: commandType === 'REJECT' ? '-' : 'cavetta-monthly-report',
    reasonDigest: normalized === null ? '-' : createHash('sha256').update(normalized).digest('hex'),
  };
  if (mutate) mutate(payload);
  const envelope = { payload, signature: sign(canonicalOf(payload)) };
  if (reason !== undefined && !omitReason) envelope.reason = reason;
  return envelope;
}

const goodObjectKey = 'Cavetta Maintenance Reports/2026/Cavetta-Monthly-Maintenance-Report-2026-09.pdf';
const goodFileName = 'Cavetta-Monthly-Maintenance-Report-2026-09.pdf';

function draftRow(overrides = {}) {
  return {
    id: 1,
    reportMonth: '2026-09',
    reportType: 'MONTHLY_MAINTENANCE',
    documentStatus: 'DRAFT',
    pdfDriveFileId: goodObjectKey,
    pdfFileName: goodFileName,
    sentAt: '',
    approvedAt: null,
    rejectedAt: null,
    rejectedReason: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Validate Signed Command cases
// ---------------------------------------------------------------------------

check('validate: valid APPROVE_AND_SEND command passes with expected fields', () => {
  const envelope = buildCommand();
  const out = runValidate(envelope);
  assert(out.commandKey === envelope.payload.commandKey, 'commandKey mismatch');
  assert(out.commandType === 'APPROVE_AND_SEND', 'commandType mismatch');
  assert(out.reportKey === envelope.payload.reportKey, 'reportKey mismatch');
  assert(out.reportMonth === '2026-09', `reportMonth mismatch: ${out.reportMonth}`);
  assert(out.reportType === 'MONTHLY_MAINTENANCE', 'reportType mismatch');
  assert(out.clientKey === 'cavetta', 'clientKey mismatch');
  assert(out.expectedRowVersion === 1, 'expectedRowVersion mismatch');
  assert(out.expectedState === 'DRAFT', 'expectedState mismatch');
  assert(out.correlationId === envelope.payload.correlationId, 'correlationId mismatch');
  assert(out.nonce === envelope.payload.nonce, 'nonce must be echoed for the claim call');
  assert(out.reason === null, 'reason must be null for APPROVE_AND_SEND');
});

assertThrowsDenied('validate: signature tamper throws', () => {
  const envelope = buildCommand();
  const last = envelope.signature[63];
  envelope.signature = envelope.signature.slice(0, 63) + (last === '0' ? '1' : '0');
  runValidate(envelope);
});

assertThrowsDenied('validate: expired expiresAt throws', () => {
  const envelope = buildCommand({ mutate: (p) => { p.issuedAt = nowSec() - 30; p.expiresAt = nowSec() - 5; } });
  runValidate(envelope);
});

assertThrowsDenied('validate: malformed reportKey throws', () => {
  runValidate(buildCommand({ reportKey: 'cavetta.weekly_maintenance.2026-09' }));
});

assertThrowsDenied('validate: wrong expectedState for command type throws', () => {
  runValidate(buildCommand({ commandType: 'APPROVE_AND_SEND', expectedState: 'SEND_FAILED' }));
});

assertThrowsDenied('validate: wrong recipientPolicyKey throws', () => {
  runValidate(buildCommand({ mutate: (p) => { p.recipientPolicyKey = 'cavetta-other-policy'; } }));
});

assertThrowsDenied('validate: REJECT without wire reason throws', () => {
  runValidate(buildCommand({ commandType: 'REJECT', reason: 'not good enough', omitReason: true }));
});

assertThrowsDenied('validate: reason digest mismatch throws', () => {
  runValidate(
    buildCommand({
      commandType: 'REJECT',
      reason: 'the real reason',
      mutate: (p) => { p.reasonDigest = createHash('sha256').update('a different reason').digest('hex'); },
    }),
  );
});

assertThrowsDenied('validate: non-REJECT command carrying reason throws', () => {
  runValidate(buildCommand({ commandType: 'APPROVE_AND_SEND', reason: 'why is this here' }));
});

check('validate: valid REJECT passes and normalizes the reason', () => {
  // Control chars (\r\n) are stripped without inserting a space, so the word
  // boundary is carried by a literal space (same as platform-api's normalizer).
  const envelope = buildCommand({ commandType: 'REJECT', reason: '  too \r\nmany   spaces ' });
  const out = runValidate(envelope);
  assert(out.commandType === 'REJECT', 'commandType mismatch');
  assert(out.reason === 'too many spaces', `reason not normalized: "${out.reason}"`);
  assert(out.expectedState === 'DRAFT', 'REJECT expects DRAFT');
});

// ---------------------------------------------------------------------------
// Guard Authoritative Row cases
// ---------------------------------------------------------------------------

function validCommandJson(options = {}) {
  return runValidate(buildCommand(options));
}

check('guard: single DRAFT row, APPROVE_AND_SEND -> APPROVED with approvedAt', () => {
  const cmd = validCommandJson();
  const out = runGuard([draftRow()], cmd);
  assert(out.guardPassed === true, `guard failed: ${out.outcome}`);
  assert(out.columns.documentStatus === 'APPROVED', 'documentStatus mismatch');
  assert(typeof out.columns.approvedAt === 'string' && out.columns.approvedAt.length > 0, 'approvedAt must be set');
  assert(out.columns.rejectedAt === null, 'rejectedAt must stay null');
  assert(out.commandKey === cmd.commandKey, 'validation fields must merge into the output');
  assert(out.reportMonth === '2026-09' && out.expectedState === 'DRAFT', 'merged fields mismatch');
});

check('guard: REJECT -> REJECTED with rejectedAt and rejectedReason', () => {
  const cmd = validCommandJson({ commandType: 'REJECT', reason: ' figures do not add up' });
  const out = runGuard([draftRow()], cmd);
  assert(out.guardPassed === true, `guard failed: ${out.outcome}`);
  assert(out.columns.documentStatus === 'REJECTED', 'documentStatus mismatch');
  assert(out.columns.rejectedAt !== null, 'rejectedAt must be set');
  assert(out.columns.rejectedReason === 'figures do not add up', `rejectedReason mismatch: "${out.columns.rejectedReason}"`);
});

check('guard: RETRY_SEND on SEND_FAILED row -> APPROVED with approvedAt null', () => {
  const cmd = validCommandJson({ commandType: 'RETRY_SEND' });
  assert(cmd.expectedState === 'SEND_FAILED', 'harness precondition: RETRY_SEND expects SEND_FAILED');
  const out = runGuard([draftRow({ documentStatus: 'SEND_FAILED' })], cmd);
  assert(out.guardPassed === true, `guard failed: ${out.outcome}`);
  assert(out.columns.documentStatus === 'APPROVED', 'documentStatus mismatch');
  assert(out.columns.approvedAt === null, 'RETRY_SEND must not set approvedAt');
});

check('guard: drifted documentStatus -> rejected_state', () => {
  const cmd = validCommandJson();
  const out = runGuard([draftRow({ documentStatus: 'APPROVED' })], cmd);
  assert(out.guardPassed === false, 'guard must fail');
  assert(out.outcome === 'rejected_state', `outcome mismatch: ${out.outcome}`);
});

check('guard: APPROVE with missing pdfDriveFileId -> rejected_pdf_unavailable', () => {
  const cmd = validCommandJson();
  const out = runGuard([draftRow({ pdfDriveFileId: '' })], cmd);
  assert(out.guardPassed === false && out.outcome === 'rejected_pdf_unavailable', `outcome mismatch: ${out.outcome}`);
});

check('guard: object key containing .. -> rejected_pdf_unavailable', () => {
  const cmd = validCommandJson();
  const evilKey = 'Cavetta Maintenance Reports/2026/../secret.pdf';
  const out = runGuard([draftRow({ pdfDriveFileId: evilKey, pdfFileName: 'secret.pdf' })], cmd);
  assert(out.guardPassed === false && out.outcome === 'rejected_pdf_unavailable', `outcome mismatch: ${out.outcome}`);
});

check('guard: non-empty sentAt -> rejected_pdf_unavailable', () => {
  const cmd = validCommandJson();
  const out = runGuard([draftRow({ sentAt: '2026-09-15T10:00:00.000Z' })], cmd);
  assert(out.guardPassed === false && out.outcome === 'rejected_pdf_unavailable', `outcome mismatch: ${out.outcome}`);
});

check('guard: zero rows -> guardPassed false with rejected_state', () => {
  const cmd = validCommandJson();
  const out = runGuard([], cmd);
  assert(out.guardPassed === false, 'guard must fail on zero rows');
  assert(out.outcome === 'rejected_state', `outcome mismatch: ${out.outcome}`);
});

check('guard: two rows -> guardPassed false with rejected_state', () => {
  const cmd = validCommandJson();
  const out = runGuard([draftRow(), draftRow({ id: 2 })], cmd);
  assert(out.guardPassed === false, 'guard must fail on two rows');
  assert(out.outcome === 'rejected_state', `outcome mismatch: ${out.outcome}`);
});

// ---------------------------------------------------------------------------

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
