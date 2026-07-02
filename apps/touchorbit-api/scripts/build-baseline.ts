import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_DIR = path.resolve(
  __dirname,
  "../../..",
  "_incoming/touchorbit-old/supabase/migrations",
);
const OUT_FILE = path.resolve(__dirname, "../migrations/0001_baseline_touchorbit_schema.sql");

const SKIP_IF_STARTS_WITH: RegExp[] = [
  /^\s*BEGIN\s*$/i,
  /^\s*COMMIT\s*$/i,
];

const SKIP_IF_CONTAINS: RegExp[] = [
  /\bCREATE\s+EXTENSION\s+/i,
  /\bCREATE\s+POLICY\s+/i,
  /\bDROP\s+POLICY\b/i,
  /\bCOMMENT\s+ON\s+POLICY\b/i,
  /\bALTER\s+TABLE\s+.*\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY\b/i,
  /\bALTER\s+TABLE\s+.*\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY\b/i,
  /\bALTER\s+TABLE\s+.*\s+FORCE\s+ROW\s+LEVEL\s+SECURITY\b/i,
  /\bGRANT\s+.*\s+TO\s+(anon|authenticated|service_role)\b/i,
  /\bREVOKE\s+.*\s+FROM\s+(anon|authenticated|service_role)\b/i,
  /\bALTER\s+DEFAULT\s+PRIVILEGES\b/i,
  /^\s*SET\s+ROLE\s+/im,
  /^\s*RESET\s+ROLE\s*$/im,
  /\bauth\./i,
  /\bstorage\./i,
  /\brealtime\./i,
];

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escapeNext = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      current += ch;
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += ch;
      if (ch === "*" && next === "/") {
        current += next;
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inDollarQuote) {
      current += ch;
      if (ch === "$") {
        const rest = sql.slice(i + 1);
        if (rest.startsWith(dollarTag + "$")) {
          current += dollarTag + "$";
          i += dollarTag.length + 1;
          inDollarQuote = false;
          dollarTag = "";
        }
      }
      continue;
    }

    if (inSingleQuote) {
      current += ch;
      if (escapeNext) {
        escapeNext = false;
      } else if (ch === "\\") {
        escapeNext = true;
      } else if (ch === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      current += ch;
      if (ch === '"') {
        inDoubleQuote = false;
      }
      continue;
    }

    if (ch === "-" && next === "-") {
      current += ch;
      inLineComment = true;
      continue;
    }

    if (ch === "/" && next === "*") {
      current += ch;
      inBlockComment = true;
      continue;
    }

    if (ch === "'") {
      current += ch;
      inSingleQuote = true;
      continue;
    }

    if (ch === '"') {
      current += ch;
      inDoubleQuote = true;
      continue;
    }

    if (ch === "$" && /\$[a-zA-Z0-9_]*\$/.test(sql.slice(i))) {
      const match = sql.slice(i).match(/^\$([a-zA-Z0-9_]*)\$/);
      if (match) {
        dollarTag = match[1];
        current += match[0];
        i += match[0].length - 1;
        inDollarQuote = true;
        continue;
      }
    }

    if (ch === ";") {
      current += ch;
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += ch;
  }

  const trimmed = current.trim();
  if (trimmed) {
    statements.push(trimmed);
  }

  return statements;
}

function shouldSkipStatement(statement: string): boolean {
  if (SKIP_IF_STARTS_WITH.some((pattern) => pattern.test(statement))) {
    return true;
  }
  return SKIP_IF_CONTAINS.some((pattern) => pattern.test(statement));
}

async function main() {
  const files = (await fs.readdir(SOURCE_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Processing ${files.length} migration files...`);

  const parts: string[] = [];
  parts.push(`-- TouchOrbit baseline schema generated from Supabase migrations`);
  parts.push(`-- Generated at: ${new Date().toISOString()}`);
  parts.push(`SET statement_timeout = 0;`);
  parts.push(`SET client_min_messages = warning;`);
  parts.push(`SET standard_conforming_strings = on;`);
  parts.push(``);
  parts.push(`-- Ensure required extensions are present`);
  parts.push(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  parts.push(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  parts.push(``);
  parts.push(`-- Platform-only additions to the users table`);
  parts.push(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS password_hash TEXT;`);
  parts.push(`ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();`);
  parts.push(``);

  for (const file of files) {
    const content = await fs.readFile(path.join(SOURCE_DIR, file), "utf-8");
    const statements = splitStatements(content);
    const kept: string[] = [];
    for (const statement of statements) {
      if (!shouldSkipStatement(statement)) {
        kept.push(statement);
      }
    }
    if (kept.length > 0) {
      parts.push(`-- source: ${file}`);
      parts.push(kept.join(";\n\n") + ";");
      parts.push(``);
    }
  }

  parts.push(`-- Migration tracking table for the custom runner`);
  parts.push(`CREATE TABLE IF NOT EXISTS migrations (`);
  parts.push(`  filename TEXT PRIMARY KEY,`);
  parts.push(`  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
  parts.push(`);`);
  parts.push(``);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, parts.join("\n"), "utf-8");

  console.log(`Wrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
