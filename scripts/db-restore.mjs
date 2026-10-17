// Restore a database backup (made with pg_dump --inserts) into a new, empty database.
//
//   npm run db:restore -- path/to/lua-database.sql
//
// Creates the database named in DATABASE_URL (it must not exist yet, or be
// empty), creates the anon/authenticated/service_role roles the backup's
// GRANTs and RLS policies refer to, then runs the backup. Use this instead
// of `db:setup` when you have a backup: the backup already contains the
// schema, every migration's bookkeeping and all the data.
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // No .env file — rely on the real environment.
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run db:restore -- <backup.sql>");
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Add it to .env first.");
  process.exit(1);
}

// pg_dump 17.6+ wraps plain dumps in psql-only `\restrict` / `\unrestrict` meta-commands.
const sql = readFileSync(resolve(file), "utf8")
  .split(/\r?\n/)
  .filter((line) => !/^\\(un)?restrict\b/.test(line))
  .join("\n");
const dbName = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ""));
if (!dbName) throw new Error("DATABASE_URL must include a database name, e.g. .../lua");

const maintenanceUrl = new URL(databaseUrl);
maintenanceUrl.pathname = "/postgres";
const admin = new pg.Client({ connectionString: maintenanceUrl.toString() });
await admin.connect();
try {
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (!rowCount) {
    await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database "${dbName}".`);
  }
} finally {
  await admin.end();
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const { rows } = await client.query(
    "SELECT count(*)::int AS n FROM pg_tables WHERE schemaname IN ('public', 'auth')",
  );
  if (rows[0].n > 0) {
    console.error(
      `Database "${dbName}" already has tables. Restore into a new database name, or drop this one first.`,
    );
    process.exitCode = 1;
  } else {
    // Roles are cluster-wide, so a backup doesn't create them. Same as db/bootstrap.sql.
    await client.query(`DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon NOLOGIN NOINHERIT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated NOLOGIN NOINHERIT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
        END IF;
        EXECUTE format('GRANT anon, authenticated, service_role TO %I', current_user);
      END
    $$`);
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    const { rows: counts } = await client.query(
      "SELECT (SELECT count(*) FROM auth.users)::int AS users, (SELECT count(*) FROM public.certificates)::int AS certificates",
    );
    console.log(`Restored: ${counts[0].users} users, ${counts[0].certificates} certificates.`);
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Restore failed, nothing was changed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
