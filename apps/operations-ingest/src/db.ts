import { Client } from 'pg';
import { config } from './config';

// The pool connects as operations_ingest, which has no table privileges and
// may only EXECUTE operations_ingest.submit_batch. All authentication,
// validation, idempotency and tenant scoping happen inside the database.

let client: Client | undefined;

export async function connectDb(): Promise<void> {
  client = new Client({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    // The ingest login owns no objects; keep the session pinned to the one
    // schema it may use.
    options: '-c search_path=operations_ingest',
    statement_timeout: 30_000,
  });
  await client.connect();
}

export async function closeDb(): Promise<void> {
  await client?.end();
}

export type SubmitBatchResult = {
  result: string;
  receiptId?: string;
  code?: string;
  accepted?: number;
  duplicates?: number;
  rejected?: number;
};

export async function submitBatch(input: {
  publisherKey: string;
  publisherSecret: string;
  batchNonce: string;
  batchDigest: string;
  records: unknown;
}): Promise<SubmitBatchResult> {
  if (!client) {
    throw new Error('database not connected');
  }
  const { rows } = await client.query(
    'SELECT operations_ingest.submit_batch($1, $2, $3, $4, $5::jsonb) AS result',
    [
      input.publisherKey,
      input.publisherSecret,
      input.batchNonce,
      input.batchDigest,
      JSON.stringify(input.records),
    ],
  );
  return rows[0].result as SubmitBatchResult;
}
