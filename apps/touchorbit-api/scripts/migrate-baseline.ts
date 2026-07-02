import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve(__dirname, "..", "migrations");

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      await client.query(
        "INSERT INTO migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
        [file],
      );
      console.log(`Baseline recorded: ${file}`);
    }

    console.log(`Baseline complete: ${files.length} migration(s) recorded.`);
  } catch (error) {
    console.error("Baseline failed:", error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
