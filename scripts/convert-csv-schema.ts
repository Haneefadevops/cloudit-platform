import fs from "node:fs";
import path from "node:path";

const CSV_FILE = process.argv[2] || "scripts/Supabase Snippet Untitled query.csv";
const OUT_FILE =
  process.argv[3] || "apps/touchorbit-api/migrations/0001_baseline_touchorbit_schema.sql";

function parseCsvRows(text: string): Array<{ sortOrder: number; ddl: string }> {
  const rows: Array<{ sortOrder: number; ddl: string }> = [];
  let i = 0;

  // Skip header line (sort_order,ddl)
  const firstNewline = text.indexOf("\n");
  if (firstNewline === -1) {
    throw new Error("CSV has no header line");
  }
  i = firstNewline + 1;

  while (i < text.length) {
    // Parse sort_order digits
    let sortStr = "";
    while (i < text.length && /\d/.test(text[i])) {
      sortStr += text[i];
      i++;
    }
    if (!sortStr) {
      // skip blank lines
      while (i < text.length && (text[i] === "\r" || text[i] === "\n")) i++;
      continue;
    }
    const sortOrder = Number(sortStr);

    // Expect comma
    if (text[i] !== ",") {
      throw new Error(`Expected comma at position ${i}, found ${text[i]}`);
    }
    i++;

    // Parse DDL field (quoted if it contains newlines, otherwise bare)
    let ddl = "";
    if (text[i] === '"') {
      i++;
      while (i < text.length) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            ddl += '"';
            i += 2;
            continue;
          } else {
            i++;
            break;
          }
        }
        ddl += text[i];
        i++;
      }
    } else {
      while (i < text.length && text[i] !== '\n' && text[i] !== '\r') {
        ddl += text[i];
        i++;
      }
    }

    rows.push({ sortOrder, ddl });

    // Advance to next line
    while (i < text.length && (text[i] === "\r" || text[i] === "\n")) i++;
  }

  return rows;
}

function sanitizeDdl(ddl: string): string | null {
  let trimmed = ddl.trim();
  if (!trimmed) return null;

  // Drop statements that reference Supabase-managed schemas or RLS.
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("create policy") ||
    lower.startsWith("drop policy") ||
    lower.startsWith("comment on policy") ||
    (lower.startsWith("alter table") && /enable\s+row\s+level\s+security/.test(lower)) ||
    (lower.startsWith("alter table") && /disable\s+row\s+level\s+security/.test(lower)) ||
    (lower.startsWith("alter table") && /force\s+row\s+level\s+security/.test(lower)) ||
    (lower.startsWith("grant") && /\b(anon|authenticated|service_role)\b/.test(lower)) ||
    (lower.startsWith("revoke") && /\b(anon|authenticated|service_role)\b/.test(lower)) ||
    lower.startsWith("alter default privileges") ||
    (lower.startsWith("alter table") && /references\s+auth\./i.test(lower)) ||
    /\bstorage\./i.test(trimmed) ||
    /\brealtime\./i.test(trimmed)
  ) {
    return null;
  }

  // Replace auth.* helpers with platform session variables so security
  // helper functions can still compile. The app sets these per request.
  // User IDs are UUIDs in the live schema, so cast the session value to uuid.
  trimmed = trimmed
    .replace(/\bauth\.uid\s*\(\s*\)/gi, "current_setting('touchorbit.current_user_id', true)::uuid")
    .replace(/\bauth\.jwt\s*\(\s*\)/gi, "current_setting('touchorbit.current_user_jwt', true)::jsonb")
    .replace(/\bauth\.role\s*\(\s*\)/gi, "current_setting('touchorbit.current_user_role', true)::text");

  return trimmed;
}

function main() {
  const csvPath = path.resolve(CSV_FILE);
  const outPath = path.resolve(OUT_FILE);

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, "utf-8").replace(/^\uFEFF/, "");
  const rows = parseCsvRows(text);

  const parts: string[] = [];
  parts.push(`-- TouchOrbit baseline schema generated from Supabase SQL Editor CSV`);
  parts.push(`-- Generated at: ${new Date().toISOString()}`);
  parts.push(`SET statement_timeout = 0;`);
  parts.push(`SET client_min_messages = warning;`);
  parts.push(`SET standard_conforming_strings = on;`);
  parts.push(`SET search_path = public;`);
  parts.push(``);
  parts.push(`-- Required extensions`);
  parts.push(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  parts.push(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  parts.push(``);
  parts.push(`-- Platform-only additions to the users table`);
  parts.push(`ALTER TABLE IF EXISTS users ALTER COLUMN id SET DEFAULT gen_random_uuid();`);
  parts.push(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  parts.push(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();`);
  parts.push(``);

  // First pass: collect constraint names so we can drop duplicate backing indexes.
  const constraintNames = new Set<string>();
  const constraintRe = /ALTER\s+TABLE\s+\S+\s+ADD\s+CONSTRAINT\s+(\S+)/i;
  for (const row of rows) {
    const ddl = sanitizeDdl(row.ddl);
    if (!ddl) continue;
    const match = constraintRe.exec(ddl);
    if (match) constraintNames.add(match[1]);
  }

  for (const row of rows) {
    let ddl = sanitizeDdl(row.ddl);
    if (!ddl) continue;

    // The catalog query accidentally wraps CHECK definitions twice.
    ddl = ddl.replace(/CHECK\s*\(\s*CHECK\s*\((.*)\)\s*\)/is, "CHECK ($1)");

    // Drop unique indexes that are already created by PRIMARY KEY / UNIQUE constraints.
    const idxMatch = /^CREATE\s+UNIQUE\s+INDEX\s+(\S+)\s+ON\s+\S+/i.exec(ddl);
    if (idxMatch && constraintNames.has(idxMatch[1])) {
      continue;
    }

    parts.push(ddl.replace(/;+\s*$/, "") + ";");
  }

  parts.push(``);
  parts.push(`-- Migration tracking table for the custom runner`);
  parts.push(`CREATE TABLE IF NOT EXISTS migrations (`);
  parts.push(`  filename TEXT PRIMARY KEY,`);
  parts.push(`  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
  parts.push(`);`);
  parts.push(``);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, parts.join("\n"), "utf-8");

  console.log(`Wrote ${outPath} (${rows.length} rows processed)`);
}

main();
