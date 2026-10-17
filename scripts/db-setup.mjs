// Create the local PostgreSQL database (if needed) and apply the schema.
//
//   npm run db:setup
//
// Runs db/bootstrap.sql (Supabase compatibility layer), then every file in
// supabase/migrations/ in filename order that hasn't been applied yet.
// Safe to re-run: applied migrations are recorded in app_meta.applied_migrations.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // No .env file — rely on the real environment.
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to .env, e.g.");
  console.error("  DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/lua");
  process.exit(1);
}

async function ensureDatabaseExists() {
  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!dbName) throw new Error("DATABASE_URL must include a database name, e.g. .../lua");

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [
      dbName,
    ]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`Created database "${dbName}".`);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  await ensureDatabaseExists();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(readFileSync(join(root, "db", "bootstrap.sql"), "utf8"));
    console.log("Applied db/bootstrap.sql");

    const migrationsDir = join(root, "supabase", "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => /^\d+.*\.sql$/.test(f)) // skips _combined_all_migrations.sql
      .sort();

    const { rows } = await client.query("SELECT filename FROM app_meta.applied_migrations");
    const applied = new Set(rows.map((r) => r.filename));

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(join(migrationsDir, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO app_meta.applied_migrations (filename) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
      console.log(`Applied ${file}`);
      count++;
    }
    console.log(count ? `Done — ${count} migration(s) applied.` : "Database is up to date.");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
