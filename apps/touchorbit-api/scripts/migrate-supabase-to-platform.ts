import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

type SourceKind = "supabase-rest" | "postgres";

type Args = {
  dryRun: boolean;
  source: SourceKind;
  csvDir?: string;
  sourceSchemaSqlDir?: string;
  only?: Set<string>;
  batchSize: number;
};

type ColumnInfo = {
  name: string;
  dataType: string;
  udtName: string;
  isNullable: boolean;
  hasDefault: boolean;
};

type TableResult = {
  table: string;
  sourceRows: number;
  inserted: number;
  skipped: number;
  failed: number;
  notes: string[];
};

const SYSTEM_SCHEMAS = new Set([
  "auth",
  "storage",
  "realtime",
  "extensions",
  "graphql",
  "graphql_public",
  "pg_catalog",
  "information_schema",
  "pgbouncer",
  "supabase_functions",
]);

const SYSTEM_TABLES = new Set([
  "migrations",
  "schema_migrations",
  "spatial_ref_sys",
  "geography_columns",
  "geometry_columns",
]);

const CORE_TABLES = [
  "organizations",
  "users",
  "branches",
  "departments",
  "employees",
  "employee_history",
  "employee_salary_components",
  "employee_salary_structure",
  "clock_events",
  "break_events",
  "leave_records",
  "leave_balances",
  "payroll_runs",
  "payroll_items",
  "roster_assignments",
  "employee_shifts",
  "shifts",
  "shift_swap_requests",
  "notifications",
  "employee_documents",
  "document_templates",
  "sent_documents",
  "assets",
  "asset_assignments",
  "asset_categories",
];

const OPTIONAL_TABLES = [
  "subscriptions",
  "geofences",
  "announcements",
  "holidays",
  "attendance_corrections",
  "overtime_records",
  "comp_off_records",
  "leave_encashment_requests",
  "leave_request_approvals",
  "overtime_request_approvals",
  "salary_components",
  "salary_revisions",
  "expense_categories",
  "expense_claims",
  "expense_claim_approvals",
  "expense_policies",
  "expense_approval_config",
  "leave_approval_config",
  "overtime_approval_config",
  "employee_emergency_contacts",
  "employee_training",
  "training_programs",
  "training_assignments",
  "employee_skills",
  "employee_goals",
  "performance_review_cycles",
  "performance_reviews",
  "calendar_events",
  "event_attendees",
  "event_attachments",
  "employee_availability",
  "employee_tasks",
  "notification_event_types",
  "notification_preferences",
  "user_dashboard_layouts",
  "public_calendar_tokens",
  "organization_meeting_providers",
  "user_meeting_providers",
  "permissions",
  "permission_groups",
  "permission_group_permissions",
  "user_permission_groups",
  "user_permission_overrides",
  "user_security_roles",
  "security_audit_log",
  "audit_events",
  "audit_policy_settings",
  "conflict_log",
  "ip_geo_cache",
  "org_positions",
  "org_chart_presence_events",
  "employee_matrix_reports",
  "roster_week_status",
  "shift_templates",
];

const MIGRATION_ORDER = [...CORE_TABLES, ...OPTIONAL_TABLES];
const USER_NAMESPACE = "touchorbit-platform-user";

const args = parseArgs(process.argv.slice(2));
const targetUrl = process.env.DATABASE_URL ?? process.env.TARGET_DATABASE_URL;
if (!targetUrl) {
  fail("DATABASE_URL or TARGET_DATABASE_URL is required for platform Postgres.");
}

const targetPool = new pg.Pool({ connectionString: targetUrl });

const sourcePool =
  args.source === "postgres"
    ? new pg.Pool({
        connectionString:
          process.env.SOURCE_DATABASE_URL ?? process.env.SUPABASE_DB_URL,
      })
    : undefined;

function parseArgs(argv: string[]): Args {
  const parsed: Args = {
    dryRun: true,
    source: "supabase-rest",
    batchSize: 500,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--full-run") parsed.dryRun = false;
    else if (arg === "--source") {
      const value = argv[++i] as SourceKind | undefined;
      if (value !== "supabase-rest" && value !== "postgres") {
        fail("--source must be supabase-rest or postgres.");
      }
      parsed.source = value;
    } else if (arg === "--source-schema-sql-dir") {
      parsed.sourceSchemaSqlDir = argv[++i];
    } else if (arg === "--only") {
      parsed.only = new Set((argv[++i] ?? "").split(",").filter(Boolean));
    } else if (arg === "--batch-size") {
      parsed.batchSize = Number(argv[++i] ?? parsed.batchSize);
      if (!Number.isInteger(parsed.batchSize) || parsed.batchSize < 1) {
        fail("--batch-size must be a positive integer.");
      }
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
Usage:
  ts-node scripts/migrate-supabase-to-platform.ts --dry-run
  ts-node scripts/migrate-supabase-to-platform.ts --full-run

Sources:
  --source supabase-rest   Reads public tables through Supabase REST using SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
  --source postgres        Reads from SOURCE_DATABASE_URL or SUPABASE_DB_URL, useful for a restored Supabase dump.

Options:
  --only table1,table2     Migrate only selected tables.
  --batch-size 500         Number of rows to fetch per page.
  --source-schema-sql-dir  Directory of Supabase migration SQL files used to report source public tables.
`);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  if (args.source === "supabase-rest") {
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  } else if (!process.env.SOURCE_DATABASE_URL && !process.env.SUPABASE_DB_URL) {
    fail("SOURCE_DATABASE_URL or SUPABASE_DB_URL is required for --source postgres.");
  }

  console.log(args.dryRun ? "Mode: dry-run" : "Mode: full-run");
  console.log(`Source: ${args.source}`);

  const sourceTables = await listSourceTables();
  const skippedSystem = sourceTables.filter((table) =>
    SYSTEM_TABLES.has(table.table),
  );
  const sourcePublicTables = sourceTables
    .filter((table) => table.schema === "public")
    .filter((table) => !SYSTEM_TABLES.has(table.table))
    .map((table) => table.table)
    .sort();

  console.log(`Source public tables (${sourcePublicTables.length}):`);
  console.log(sourcePublicTables.join(", ") || "(none)");
  if (skippedSystem.length > 0) {
    console.log(
      `Skipped system tables: ${skippedSystem
        .map((table) => `${table.schema}.${table.table}`)
        .join(", ")}`,
    );
  }
  console.log(
    `Skipped system schemas: ${Array.from(SYSTEM_SCHEMAS).sort().join(", ")}`,
  );

  const targetSchema = await getTargetSchema();
  const targetTables = new Set(targetSchema.keys());
  const tablePlan = MIGRATION_ORDER.filter((table) => targetTables.has(table))
    .filter((table) => sourcePublicTables.includes(table))
    .filter((table) => !args.only || args.only.has(table));

  const unmappedSourceTables = sourcePublicTables.filter(
    (table) => !MIGRATION_ORDER.includes(table),
  );
  const missingTargetTables = MIGRATION_ORDER.filter(
    (table) => sourcePublicTables.includes(table) && !targetTables.has(table),
  );

  console.log(`Mapped tables (${tablePlan.length}): ${tablePlan.join(", ")}`);
  if (unmappedSourceTables.length > 0) {
    console.log(`Unmapped source tables: ${unmappedSourceTables.join(", ")}`);
  }
  if (missingTargetTables.length > 0) {
    console.log(`Mapped source tables missing in target: ${missingTargetTables.join(", ")}`);
  }

  const idMaps = await buildIdMaps(tablePlan);
  const client = await targetPool.connect();
  const results: TableResult[] = [];

  try {
    if (!args.dryRun) await client.query("BEGIN");

    for (const table of tablePlan) {
      const columns = targetSchema.get(table);
      if (!columns) continue;
      const result = await migrateTable(client, table, columns, idMaps);
      results.push(result);
      logTableResult(result);
    }

    if (!args.dryRun) await client.query("COMMIT");
  } catch (error) {
    if (!args.dryRun) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await sourcePool?.end();
    await targetPool.end();
  }

  console.log("\nVerification row counts:");
  await printTargetCounts(tablePlan);
  printSummary(results, unmappedSourceTables, missingTargetTables);
}

function requireEnv(name: string) {
  if (!process.env[name]) fail(`${name} is required.`);
}

async function listSourceTables(): Promise<Array<{ schema: string; table: string }>> {
  if (args.source === "postgres") {
    const rows = await sourcePool!.query<{ table_schema: string; table_name: string }>(
      `
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE table_type = 'BASE TABLE'
        ORDER BY table_schema, table_name
      `,
    );
    return rows.rows
      .filter((row) => !SYSTEM_SCHEMAS.has(row.table_schema))
      .map((row) => ({ schema: row.table_schema, table: row.table_name }));
  }

  const sqlDir =
    args.sourceSchemaSqlDir ??
    path.resolve(__dirname, "../../../_incoming/touchorbit-old/supabase/migrations");
  try {
    return await listTablesFromSqlDir(sqlDir);
  } catch (error) {
    console.warn(
      `Could not parse source schema SQL from ${sqlDir}; falling back to known migration tables.`,
    );
    console.warn(error instanceof Error ? error.message : String(error));
    return MIGRATION_ORDER.map((table) => ({ schema: "public", table }));
  }
}

async function listTablesFromSqlDir(dir: string) {
  const files = (await fs.readdir(dir))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const tables = new Set<string>();
  const tablePattern =
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?<schema>[a-zA-Z_][\w]*)\.)?(?<table>[a-zA-Z_][\w]*)/gi;

  for (const file of files) {
    const sql = await fs.readFile(path.join(dir, file), "utf8");
    for (const match of sql.matchAll(tablePattern)) {
      const schema = match.groups?.schema ?? "public";
      const table = match.groups?.table;
      if (!table || SYSTEM_SCHEMAS.has(schema)) continue;
      tables.add(`${schema}.${table}`);
    }
  }

  return Array.from(tables)
    .sort()
    .map((name) => {
      const [schema, table] = name.split(".");
      return { schema, table };
    });
}

async function getTargetSchema() {
  const result = await targetPool.query<{
    table_name: string;
    column_name: string;
    data_type: string;
    udt_name: string;
    is_nullable: string;
    column_default: string | null;
  }>(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `);

  const schema = new Map<string, ColumnInfo[]>();
  for (const row of result.rows) {
    const columns = schema.get(row.table_name) ?? [];
    columns.push({
      name: row.column_name,
      dataType: row.data_type,
      udtName: row.udt_name,
      isNullable: row.is_nullable === "YES",
      hasDefault: row.column_default !== null,
    });
    schema.set(row.table_name, columns);
  }
  return schema;
}

async function buildIdMaps(tablePlan: string[]) {
  const userIdMap = new Map<string, string>();
  if (!tablePlan.includes("users")) return { userIdMap };

  for await (const row of readSourceRows("users")) {
    const oldId = stringValue(row.id);
    if (oldId) userIdMap.set(oldId, toPlatformUserId(oldId));
  }

  return { userIdMap };
}

async function migrateTable(
  client: pg.PoolClient,
  table: string,
  columns: ColumnInfo[],
  idMaps: { userIdMap: Map<string, string> },
): Promise<TableResult> {
  const result: TableResult = {
    table,
    sourceRows: 0,
    inserted: 0,
    skipped: 0,
    failed: 0,
    notes: [],
  };

  const columnNames = columns.map((column) => column.name);

  for await (const sourceRow of readSourceRows(table)) {
    result.sourceRows++;
    const row = transformRow(table, sourceRow, columns, idMaps);
    const insertColumns = columnNames.filter((column) => row[column] !== undefined);

    if (insertColumns.length === 0) {
      result.skipped++;
      result.notes.push("row skipped because no target columns matched");
      continue;
    }

    if (args.dryRun) {
      result.inserted++;
      if (result.sourceRows <= 3) {
        console.log(`[dry-run] ${table}: ${JSON.stringify(project(row, insertColumns))}`);
      }
      continue;
    }

    try {
      const values = insertColumns.map((column) => row[column]);
      const placeholders = insertColumns.map((_, index) => `$${index + 1}`);
      const sql = `
        INSERT INTO public.${quoteIdent(table)} (${insertColumns.map(quoteIdent).join(", ")})
        VALUES (${placeholders.join(", ")})
        ON CONFLICT DO NOTHING
      `;
      const insert = await client.query(sql, values);
      result.inserted += insert.rowCount ?? 0;
      if ((insert.rowCount ?? 0) === 0) result.skipped++;
    } catch (error) {
      result.failed++;
      result.notes.push(error instanceof Error ? error.message : String(error));
      console.error(`Failed row in ${table}:`, error);
    }
  }

  return result;
}

function transformRow(
  table: string,
  sourceRow: Record<string, unknown>,
  columns: ColumnInfo[],
  idMaps: { userIdMap: Map<string, string> },
) {
  const transformed: Record<string, unknown> = {};
  const targetColumns = new Set(columns.map((column) => column.name));

  for (const [key, value] of Object.entries(sourceRow)) {
    if (!targetColumns.has(key)) continue;
    transformed[key] = normalizeValue(value);
  }

  if (table === "users") {
    const oldId = stringValue(sourceRow.id);
    if (oldId) transformed.id = toPlatformUserId(oldId);
    transformed.email = stringValue(sourceRow.email)?.toLowerCase() ?? transformed.email;
    transformed.role = normalizeRole(sourceRow.role);
  }

  for (const column of columns) {
    if (transformed[column.name] === undefined) continue;
    if (isUserReferenceColumn(table, column.name)) {
      const original = stringValue(transformed[column.name]);
      if (original && idMaps.userIdMap.has(original)) {
        transformed[column.name] = idMaps.userIdMap.get(original);
      } else if (original && column.udtName === "uuid" && !isUuid(original)) {
        transformed[column.name] = toPlatformUserId(original);
      }
    }
    if (column.udtName === "uuid") {
      const original = stringValue(transformed[column.name]);
      if (original === "") transformed[column.name] = null;
    }
    if (column.udtName === "jsonb" || column.udtName === "json") {
      transformed[column.name] = normalizeJson(transformed[column.name]);
    }
  }

  return transformed;
}

function normalizeRole(value: unknown) {
  const role = stringValue(value);
  if (!role) return "employee";
  const allowed = new Set(["owner", "manager", "hr_admin", "employee"]);
  return allowed.has(role) ? role : "employee";
}

function isUserReferenceColumn(table: string, column: string) {
  if (table === "users" && column === "id") return true;
  if (column === "user_id") return true;
  return [
    "created_by",
    "updated_by",
    "approved_by",
    "rejected_by",
    "requested_by",
    "reviewer_id",
    "terminated_by",
    "uploaded_by",
    "assigned_by",
    "read_by",
  ].includes(column);
}

function normalizeValue(value: unknown): unknown {
  if (value === "") return null;
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return value;
  return value;
}

function normalizeJson(value: unknown) {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

async function* readSourceRows(table: string): AsyncGenerator<Record<string, unknown>> {
  if (args.source === "postgres") {
    let offset = 0;
    while (true) {
      const result = await sourcePool!.query<Record<string, unknown>>(
        `SELECT * FROM public.${quoteIdent(table)} ORDER BY 1 LIMIT $1 OFFSET $2`,
        [args.batchSize, offset],
      );
      if (result.rows.length === 0) break;
      for (const row of result.rows) yield row;
      offset += result.rows.length;
    }
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL!.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  let offset = 0;

  while (true) {
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set("select", "*");
    url.searchParams.set("limit", String(args.batchSize));
    url.searchParams.set("offset", String(offset));

    const response = await fetch(url, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (response.status === 404) return;
    if (!response.ok) {
      throw new Error(
        `Supabase REST read failed for ${table}: ${response.status} ${await response.text()}`,
      );
    }

    const rows = (await response.json()) as Array<Record<string, unknown>>;
    if (rows.length === 0) break;
    for (const row of rows) yield row;
    offset += rows.length;
  }
}

function toPlatformUserId(oldId: string) {
  if (isUuid(oldId)) return oldId;
  return deterministicUuid(`${USER_NAMESPACE}:${oldId}`);
}

function deterministicUuid(value: string) {
  const hash = crypto.createHash("sha1").update(value).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function quoteIdent(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function project(row: Record<string, unknown>, columns: string[]) {
  return Object.fromEntries(columns.map((column) => [column, row[column]]));
}

function logTableResult(result: TableResult) {
  console.log(
    `${result.table}: source=${result.sourceRows}, inserted=${result.inserted}, skipped=${result.skipped}, failed=${result.failed}`,
  );
}

async function printTargetCounts(tables: string[]) {
  const pool = new pg.Pool({ connectionString: targetUrl });
  try {
    for (const table of tables) {
      const result = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM public.${quoteIdent(table)}`,
      );
      console.log(`${table}: ${result.rows[0]?.count ?? "0"}`);
    }
  } finally {
    await pool.end();
  }
}

function printSummary(
  results: TableResult[],
  unmappedSourceTables: string[],
  missingTargetTables: string[],
) {
  const totals = results.reduce(
    (acc, result) => {
      acc.sourceRows += result.sourceRows;
      acc.inserted += result.inserted;
      acc.skipped += result.skipped;
      acc.failed += result.failed;
      return acc;
    },
    { sourceRows: 0, inserted: 0, skipped: 0, failed: 0 },
  );

  console.log("\nMigration summary:");
  console.table(
    results.map((result) => ({
      table: result.table,
      sourceRows: result.sourceRows,
      inserted: result.inserted,
      skipped: result.skipped,
      failed: result.failed,
    })),
  );
  console.log(
    `Totals: source=${totals.sourceRows}, inserted=${totals.inserted}, skipped=${totals.skipped}, failed=${totals.failed}`,
  );
  console.log(
    "Passwords were not migrated. Users must reset passwords in the platform auth system.",
  );
  if (unmappedSourceTables.length > 0) {
    console.log(`Could not map: ${unmappedSourceTables.join(", ")}`);
  }
  if (missingTargetTables.length > 0) {
    console.log(`Missing target tables: ${missingTargetTables.join(", ")}`);
  }
}

main().catch(async (error) => {
  console.error(error);
  await sourcePool?.end().catch(() => undefined);
  await targetPool.end().catch(() => undefined);
  process.exit(1);
});
