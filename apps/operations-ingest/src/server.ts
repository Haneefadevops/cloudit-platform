import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config, publisherSecretFor, knownPublisherKeys } from './config';
import {
  buildCanonicalString,
  hmacSha256Hex,
  isValidHex64,
  sha256Hex,
  signaturesEqual,
} from './signature';
import { connectDb, closeDb, submitBatch } from './db';

// Private evidence ingestion endpoint (Phase 0 section 7.1).
//
// This service is reachable only on the private Docker network — it has no
// published port and no reverse-proxy route, so the browser can never call
// it. It verifies the per-publisher HMAC transport signature and rejects
// stale timestamps, then delegates ALL authentication, nonce-replay
// handling, validation, idempotency and tenant scoping to
// operations_ingest.submit_batch in the operations database. Batch replays
// return the original receipt there and never rewrite evidence, so an
// idempotent client retry of the exact same request is a success, not an
// error.
//
// Responses and logs carry only receipt ids, safe machine codes and counts —
// never the submitted payload, a stack trace, the secret, or raw errors.

const NONCE_PATTERN = /^[A-Za-z0-9_-]{8,160}$/;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(text);
}

function safeLog(message: string): void {
  console.log(`[ingest] ${new Date().toISOString()} ${message}`);
}

async function readBody(req: IncomingMessage): Promise<Buffer | 'too-large'> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    total += buffer.length;
    if (total > config.maxBodyBytes) {
      return 'too-large';
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function header(req: IncomingMessage, name: string): string {
  const value = req.headers[name];
  return typeof value === 'string' ? value.trim() : '';
}

function isValidTimestamp(value: string): boolean {
  return /^\d{10}$/.test(value);
}

function isStaleTimestamp(value: string): boolean {
  const ts = Number(value);
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) > config.timestampToleranceSeconds;
}

async function handleBatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const publisherKey = header(req, 'x-publisher-key');
  const timestamp = header(req, 'x-timestamp');
  const nonce = header(req, 'x-nonce');
  const signature = header(req, 'x-signature');

  const body = await readBody(req);
  if (body === 'too-large') {
    sendJson(res, 413, { result: 'rejected', code: 'oversized_body' });
    safeLog(`request rejected code=oversized_body publisher=${publisherKey || '-'}`);
    return;
  }

  if (!publisherKey || !isValidTimestamp(timestamp) || !NONCE_PATTERN.test(nonce) || !isValidHex64(signature)) {
    sendJson(res, 400, { result: 'rejected', code: 'invalid_request' });
    safeLog(`request rejected code=invalid_request publisher=${publisherKey || '-'}`);
    return;
  }

  if (isStaleTimestamp(timestamp)) {
    sendJson(res, 401, { result: 'rejected', code: 'stale_timestamp' });
    safeLog(`request rejected code=stale_timestamp publisher=${publisherKey}`);
    return;
  }

  const secret = publisherSecretFor(publisherKey);
  if (!secret) {
    sendJson(res, 401, { result: 'rejected', code: 'unknown_publisher' });
    safeLog(`request rejected code=unknown_publisher publisher=${publisherKey}`);
    return;
  }

  const bodyDigest = sha256Hex(body);
  const expected = hmacSha256Hex(
    secret,
    buildCanonicalString(timestamp, nonce, bodyDigest),
  );
  if (!signaturesEqual(signature, expected)) {
    sendJson(res, 401, { result: 'rejected', code: 'invalid_signature' });
    safeLog(`request rejected code=invalid_signature publisher=${publisherKey}`);
    return;
  }

  let records: unknown;
  try {
    records = JSON.parse(body.toString('utf8'));
  } catch {
    sendJson(res, 400, { result: 'rejected', code: 'invalid_json' });
    safeLog(`request rejected code=invalid_json publisher=${publisherKey}`);
    return;
  }

  let outcome;
  try {
    outcome = await submitBatch({
      publisherKey,
      publisherSecret: secret,
      batchNonce: nonce,
      batchDigest: bodyDigest,
      records,
    });
  } catch (err) {
    // Unexpected database failure: a safe code only, never the raw error.
    sendJson(res, 503, { result: 'rejected', code: 'ingestion_unavailable' });
    safeLog(
      `request failed code=ingestion_unavailable publisher=${publisherKey} error=${err instanceof Error ? err.name : 'unknown'}`,
    );
    return;
  }

  const status =
    outcome.result === 'accepted' || outcome.result === 'duplicate_batch'
      ? 200
      : outcome.result === 'rejected_authentication'
        ? 401
        : 422;
  sendJson(res, status, outcome);
  safeLog(
    `batch result=${outcome.result} publisher=${publisherKey} receipt=${outcome.receiptId ?? '-'} code=${outcome.code ?? '-'} accepted=${outcome.accepted ?? 0} duplicates=${outcome.duplicates ?? 0} rejected=${outcome.rejected ?? 0}`,
  );
}

async function main(): Promise<void> {
  await connectDb();

  const server = createServer((req, res) => {
    void (async () => {
      try {
        const url = req.url ?? '/';
        if (req.method === 'GET' && url === '/health') {
          sendJson(res, 200, { status: 'ok' });
          return;
        }
        if (req.method === 'POST' && url === '/v1/batches') {
          await handleBatch(req, res);
          return;
        }
        sendJson(res, 404, { result: 'rejected', code: 'not_found' });
      } catch (err) {
        if (!res.headersSent) {
          sendJson(res, 500, { result: 'rejected', code: 'internal_error' });
        }
        safeLog(`unhandled error=${err instanceof Error ? err.name : 'unknown'}`);
      }
    })();
  });

  server.listen(config.port, () => {
    safeLog(
      `listening on ${config.port} publishers=[${knownPublisherKeys().join(',') || 'none configured'}]`,
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    safeLog(`received ${signal}, shutting down`);
    server.close();
    await closeDb().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error(`[ingest] fatal startup error: ${err instanceof Error ? err.name : 'unknown'}`);
  process.exit(1);
});
