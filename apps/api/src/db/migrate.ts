import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "./pool";

export async function migrate(): Promise<string[]> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  const directory = path.join(__dirname, "migrations");
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  const applied: string[] = [];
  for (const file of files) {
    const existing = await pool.query("SELECT 1 FROM schema_migrations WHERE id = $1", [file]);
    if (existing.rowCount) continue;
    const sql = await readFile(path.join(directory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  return applied;
}

if (require.main === module) {
  migrate()
    .then((applied) => {
      console.log(applied.length ? `applied ${applied.join(", ")}` : "migrations up to date");
      return getPool().end();
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
