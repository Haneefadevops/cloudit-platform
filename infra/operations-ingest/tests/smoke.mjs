// CloudIT Operations Portal — Phase 4 endpoint smoke/gate suite.
//
// Runs signed HTTP requests against the private operations-ingest service and
// (optionally) checks database rows through a throwaway PostgreSQL container.
// The suite only touches a throwaway operations database created for testing;
// never point PG_CONTAINER at a shared database.
//
// Required environment:
//   PUBLISHER_SECRET   the Cavetta publisher secret (test-only value)
// Optional:
//   BASE_URL           default http://localhost:3020
//   PUBLISHER_KEY      default cavetta-production-n8n
//   PG_CONTAINER       default operations-phase4-test (docker container name)
//   PG_USER            default cloudit
//
// Usage:
//   node infra/operations-ingest/tests/smoke.mjs

import { createHash, createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3020';
const PUBLISHER_KEY = process.env.PUBLISHER_KEY ?? 'cavetta-production-n8n';
const SECRET = process.env.PUBLISHER_SECRET ?? '';
const PG_CONTAINER = process.env.PG_CONTAINER ?? 'operations-phase4-test';
const PG_USER = process.env.PG_USER ?? 'cloudit';

if (!SECRET) {
  console.error('PUBLISHER_SECRET is required (use a throwaway test value)');
  process.exit(1);
}

const results = [];
function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
}

function sign(bodyText, timestamp, nonce) {
  const digest = createHash('sha256').update(bodyText, 'utf8').digest('hex');
  const signature = createHmac('sha256', SECRET)
    .update(`${timestamp}.${nonce}.${digest}`)
    .digest('hex');
  return { digest, signature };
}

async function postBatch({ publisherKey = PUBLISHER_KEY, bodyText, timestamp, nonce, signature, secret = SECRET }) {
  const sig =
    signature ??
    createHmac('sha256', secret)
      .update(`${timestamp}.${nonce}.${createHash('sha256').update(bodyText, 'utf8').digest('hex')}`)
      .digest('hex');
  const res = await fetch(`${BASE_URL}/v1/batches`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-publisher-key': publisherKey,
      'x-timestamp': timestamp,
      'x-nonce': nonce,
      'x-signature': sig,
    },
    body: bodyText,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // leave null
  }
  return { status: res.status, json };
}

function envelope(recordType, idempotencyKey, payload) {
  const now = new Date().toISOString();
  const freshUntil = new Date(Date.now() + 3600_000).toISOString();
  return {
    contractVersion: '1.0',
    recordType,
    idempotencyKey,
    environmentKey: 'production',
    sourceSystem: 'n8n',
    observedAt: now,
    publishedAt: now,
    freshUntil,
    status: 'GREEN',
    severity: 'none',
    correlationKey: null,
    payload,
  };
}

function executionPayload(executionKey) {
  const now = new Date().toISOString();
  const finished = new Date(Date.now() + 950).toISOString();
  return {
    workflowKey: 'cavetta.automation_watchdog',
    executionKey,
    triggerKind: 'cron',
    scheduledFor: now,
    startedAt: now,
    finishedAt: finished,
    durationMs: 950,
    scheduleDelayMs: 120,
    outcome: 'success',
    sourceRevisionKey: 'smoke-rev-1',
  };
}

function psqlCount(sql) {
  const out = execFileSync('docker', ['exec', PG_CONTAINER, 'psql', '-U', PG_USER, '-d', 'operations', '-tAc', sql], {
    encoding: 'utf8',
  });
  return Number(out.trim());
}

const executionsCount = () =>
  psqlCount(
    "SELECT count(*) FROM operations.workflow_executions WHERE client_id = (SELECT id FROM operations.clients WHERE client_key='cavetta')",
  );

const nowSeconds = () => Math.floor(Date.now() / 1000).toString();
const newNonce = () => randomBytes(16).toString('base64url');

// --- 1. health ---------------------------------------------------------------
try {
  const res = await fetch(`${BASE_URL}/health`);
  const json = await res.json();
  record('health_ok', res.status === 200 && json.status === 'ok', `status=${res.status}`);
} catch (err) {
  record('health_ok', false, String(err));
  console.error('service unreachable, aborting');
  process.exit(1);
}

// --- 2. signed batch accepted -------------------------------------------------
const bodyText = JSON.stringify([envelope('workflow_execution', 'smoke-exec-1', executionPayload('smoke-exec-1'))]);
const t2 = nowSeconds();
const n2 = newNonce();
const r2 = await postBatch({ bodyText, timestamp: t2, nonce: n2 });
record(
  'signed_batch_accepted',
  r2.status === 200 && r2.json?.result === 'accepted' && r2.json?.accepted === 1,
  `status=${r2.status} result=${r2.json?.result}`,
);
const receiptId = r2.json?.receiptId;

// --- 3. same nonce + body retry returns the original receipt ------------------
const r3 = await postBatch({ bodyText, timestamp: t2, nonce: n2 });
record(
  'batch_retry_returns_original_receipt',
  r3.status === 200 && r3.json?.result === 'duplicate_batch' && r3.json?.receiptId === receiptId,
  `result=${r3.json?.result} receipt=${r3.json?.receiptId}`,
);

// --- 4. record-level replay: same idempotency key, new nonce ------------------
const r4 = await postBatch({ bodyText, timestamp: nowSeconds(), nonce: newNonce() });
record(
  'record_replay_counted_duplicate',
  r4.status === 200 && r4.json?.result === 'accepted' && r4.json?.duplicates === 1,
  `result=${r4.json?.result} duplicates=${r4.json?.duplicates}`,
);
try {
  record('record_replay_no_extra_row', executionsCount() === 1, `rows=${executionsCount()}`);
} catch (err) {
  record('record_replay_no_extra_row', false, `psql unavailable: ${err.message}`);
}

// --- 5. invalid signature ------------------------------------------------------
const r5 = await postBatch({ bodyText, timestamp: nowSeconds(), nonce: newNonce(), signature: '0'.repeat(64) });
record('invalid_signature_rejected', r5.status === 401 && r5.json?.code === 'invalid_signature', `status=${r5.status}`);

// --- 6. stale timestamp ---------------------------------------------------------
const r6 = await postBatch({ bodyText, timestamp: (nowSeconds() - 400).toString(), nonce: newNonce() });
record('stale_timestamp_rejected', r6.status === 401 && r6.json?.code === 'stale_timestamp', `status=${r6.status}`);

// --- 7. replayed nonce with a different body returns the original receipt ------
// Per Phase 0 section 7.1 a reused nonce never rewrites evidence: the database
// returns the original receipt regardless of body, so the second batch is
// effectively ignored and no rows appear.
const otherBody = JSON.stringify([envelope('workflow_execution', 'smoke-exec-2', executionPayload('smoke-exec-2'))]);
const r7 = await postBatch({ bodyText: otherBody, timestamp: nowSeconds(), nonce: n2 });
let nonceReplayOk = r7.status === 200 && r7.json?.result === 'duplicate_batch' && r7.json?.receiptId === receiptId;
if (nonceReplayOk) {
  try {
    nonceReplayOk = executionsCount() === 1;
  } catch {
    nonceReplayOk = false;
  }
}
record('replayed_nonce_returns_original_receipt', nonceReplayOk, `result=${r7.json?.result} receipt=${r7.json?.receiptId}`);

// --- 8. unknown publisher --------------------------------------------------------
const r8 = await postBatch({ publisherKey: 'no-such-publisher', bodyText, timestamp: nowSeconds(), nonce: newNonce(), secret: 'whatever-secret-0123456789abcd' });
record('unknown_publisher_rejected', r8.status === 401 && r8.json?.code === 'unknown_publisher', `status=${r8.status}`);

// --- 9. forbidden payload field ---------------------------------------------------
const badBody = JSON.stringify([
  envelope('workflow_execution', 'smoke-bad-1', { ...executionPayload('smoke-bad-1'), stack: 'boom' }),
]);
const r9 = await postBatch({ bodyText: badBody, timestamp: nowSeconds(), nonce: newNonce() });
record(
  'forbidden_field_rejected',
  r9.status === 422 && r9.json?.result === 'rejected_validation',
  `status=${r9.status} code=${r9.json?.code}`,
);

// --- 10. mixed batch rejected atomically -------------------------------------------
const mixedBody = JSON.stringify([
  envelope('workflow_execution', 'smoke-mixed-1', executionPayload('smoke-mixed-1')),
  envelope('workflow_execution', 'smoke-mixed-2', { ...executionPayload('smoke-mixed-2'), stack: 'boom' }),
]);
const r10 = await postBatch({ bodyText: mixedBody, timestamp: nowSeconds(), nonce: newNonce() });
let atomicOk = r10.status === 422 && r10.json?.result === 'rejected_validation';
if (atomicOk) {
  try {
    atomicOk = executionsCount() === 1;
  } catch {
    atomicOk = false;
  }
}
record('mixed_batch_atomic_rejection', atomicOk, `status=${r10.status} code=${r10.json?.code}`);

// --- 11. oversized body -------------------------------------------------------------
const bigPayload = { ...executionPayload('smoke-big-1'), filler: 'x'.repeat(1_100_000) };
const r11 = await postBatch({
  bodyText: JSON.stringify([envelope('workflow_execution', 'smoke-big-1', bigPayload)]),
  timestamp: nowSeconds(),
  nonce: newNonce(),
});
record('oversized_body_rejected', r11.status === 413 && r11.json?.code === 'oversized_body', `status=${r11.status}`);

// --- summary -------------------------------------------------------------------------
const passed = results.filter((r) => r.pass).length;
console.log('----------------------------------------');
console.log(`total=${results.length} passed=${passed} failed=${results.length - passed}`);
if (passed !== results.length) {
  process.exit(1);
}
console.log('SMOKE TESTS PASSED');
