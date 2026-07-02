import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function ensureMigrationsTable(client: pg.PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(
  client: pg.PoolClient,
): Promise<Set<string>> {
  const result = await client.query<{ filename: string }>(
    "SELECT filename FROM migrations",
  );
  return new Set(result.rows.map((r) => r.filename));
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureMigrationsTable(client);

    const applied = await getAppliedMigrations(client);
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, "utf-8");

      console.log(`Applying migration: ${file}`);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO migrations (filename) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        console.error(`Migration failed while applying ${file}:`, error);
        throw error;
      }
      appliedCount++;
    }

    console.log(
      appliedCount === 0
        ? "No new migrations to apply."
        : `Applied ${appliedCount} migration(s).`,
    );
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
