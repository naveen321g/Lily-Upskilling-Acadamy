// One-time copy of all data from a Supabase project into the local PostgreSQL database.
//
//   npm run db:import-supabase -- --dry-run   # show what would be copied
//   npm run db:import-supabase                # copy it
//
// Needs in .env: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
//
// What it does, in one transaction:
//   - Replaces every row in the local public.* tables with the Supabase rows
//     (same ids), except the profiles/user_roles of local-only accounts,
//     which are kept.
//   - Copies the Supabase auth users (same ids, emails, metadata). Supabase's
//     API doesn't expose password hashes, so imported users get NO usable
//     password: set one with `npm run db:create-user -- <email> <password>`
//     or use "Forgot password".
//   - Downloads the certificate files from Supabase Storage into
//     LOCAL_STORAGE_DIR and records them in storage.objects.
// Triggers and FK checks are suspended during the copy so rows can be loaded
// in any order without re-firing handle_new_user() etc.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  // No .env file — rely on the real environment.
}

const dryRun = process.argv.includes("--dry-run");
const { DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
for (const [name, value] of Object.entries({
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
})) {
  if (!value) {
    console.error(`${name} is not set in .env.`);
    process.exit(1);
  }
}

const base = SUPABASE_URL.replace(/\/$/, "");
const headers = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
};

async function getJson(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok)
    throw new Error(
      `${init.method ?? "GET"} ${path} -> HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  return res.json();
}

async function fetchTable(table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const page = await getJson(`/rest/v1/${table}?select=*`, {
      headers: { Range: `${from}-${from + pageSize - 1}`, "Range-Unit": "items" },
    });
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

async function fetchAuthUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { users: batch = [] } = await getJson(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    users.push(...batch);
    if (batch.length < 1000) return users;
  }
}

/** Recursively list every object in a bucket (folders come back with id = null). */
async function listObjects(bucket, prefix = "") {
  const entries = await getJson(`/storage/v1/object/list/${bucket}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prefix, limit: 1000, offset: 0 }),
  });
  const out = [];
  for (const e of entries) {
    const path = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) out.push(...(await listObjects(bucket, path)));
    else out.push({ ...e, path });
  }
  return out;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Supabase's listing may omit `owner`; uploads live under `<userId>/...`, so fall back to that. */
function ownerOf(obj) {
  const candidate = obj.owner ?? obj.owner_id ?? obj.path.split("/")[0];
  return UUID.test(candidate ?? "") ? candidate : null;
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

try {
  const { rows: tableRows } = await db.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  );
  const tables = tableRows.map((r) => r.tablename);

  console.log("Reading from Supabase...");
  const authUsers = await fetchAuthUsers();
  const cloud = {};
  for (const table of tables) {
    try {
      cloud[table] = await fetchTable(table);
    } catch (error) {
      console.warn(`  skip ${table}: ${error.message}`);
    }
  }
  const { rows: buckets } = await db.query("SELECT id FROM storage.buckets");
  const objects = {};
  for (const { id } of buckets) objects[id] = await listObjects(id);

  const cloudUserIds = new Set(authUsers.map((u) => u.id));
  const { rows: localUsers } = await db.query("SELECT id, email FROM auth.users");
  const keptLocal = localUsers.filter((u) => !cloudUserIds.has(u.id));
  const clash = keptLocal.filter((u) => authUsers.some((c) => c.email.toLowerCase() === u.email));
  if (clash.length)
    throw new Error(
      `Local accounts share an email with Supabase users: ${clash.map((u) => u.email)}`,
    );

  console.log(
    `\n  auth users: ${authUsers.length} (local-only accounts kept: ${keptLocal.map((u) => u.email).join(", ") || "none"})`,
  );
  for (const table of tables)
    if (cloud[table]) console.log(`  ${table}: ${cloud[table].length} rows`);
  for (const [bucket, list] of Object.entries(objects))
    console.log(`  storage/${bucket}: ${list.length} files`);

  if (dryRun) {
    console.log("\nDry run — nothing was written.");
    process.exit(0);
  }

  // Download files before touching the database, so a network failure leaves it untouched.
  const storageRoot = resolve(process.env.LOCAL_STORAGE_DIR || join(root, ".local-storage"));
  const files = [];
  for (const [bucket, list] of Object.entries(objects)) {
    for (const obj of list) {
      const encoded = obj.path.split("/").map(encodeURIComponent).join("/");
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${encoded}`, { headers });
      if (!res.ok) throw new Error(`download ${bucket}/${obj.path} -> HTTP ${res.status}`);
      files.push({ bucket, obj, body: Buffer.from(await res.arrayBuffer()) });
    }
  }

  const keptIds = keptLocal.map((u) => u.id);
  await db.query("BEGIN");
  await db.query("SET LOCAL session_replication_role = replica"); // no triggers / FK checks

  for (const table of tables) {
    if (!cloud[table]) continue;
    const { rows: cols } = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
      [table],
    );
    const localCols = cols.map((c) => c.column_name);
    // Keep local-only accounts' own profile/role rows; replace everything else.
    if (table === "profiles")
      await db.query("DELETE FROM public.profiles WHERE NOT (id = ANY($1))", [keptIds]);
    else if (table === "user_roles")
      await db.query("DELETE FROM public.user_roles WHERE NOT (user_id = ANY($1))", [keptIds]);
    else await db.query(`DELETE FROM public."${table}"`);

    if (!cloud[table].length) continue;
    const present = localCols.filter((c) =>
      Object.prototype.hasOwnProperty.call(cloud[table][0], c),
    );
    const list = present.map((c) => `"${c}"`).join(", ");
    await db.query(
      `INSERT INTO public."${table}" (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::public."${table}", $1::jsonb)`,
      [JSON.stringify(cloud[table])],
    );
  }

  await db.query("DELETE FROM auth.sessions WHERE user_id = ANY($1)", [[...cloudUserIds]]);
  await db.query("DELETE FROM auth.users WHERE id = ANY($1)", [[...cloudUserIds]]);
  for (const u of authUsers) {
    await db.query(
      `INSERT INTO auth.users (id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data,
         email_confirmed_at, last_sign_in_at, banned_until, created_at, updated_at)
       VALUES ($1, $2, '!imported-no-password', $3, $4, $5, $6, $7, $8, $9)`,
      [
        u.id,
        u.email.toLowerCase(),
        JSON.stringify(u.user_metadata ?? {}),
        JSON.stringify(u.app_metadata ?? {}),
        u.email_confirmed_at ?? null,
        u.last_sign_in_at ?? null,
        u.banned_until && u.banned_until !== "none" ? u.banned_until : null,
        u.created_at,
        u.updated_at ?? u.created_at,
      ],
    );
  }

  for (const { bucket, obj, body } of files) {
    await db.query(
      `INSERT INTO storage.objects (bucket_id, name, owner, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, coalesce($5, now()), coalesce($6, now()))
       ON CONFLICT (bucket_id, name) DO UPDATE SET metadata = EXCLUDED.metadata, owner = EXCLUDED.owner`,
      [
        bucket,
        obj.path,
        ownerOf(obj),
        JSON.stringify({
          size: obj.metadata?.size ?? body.length,
          mimetype: obj.metadata?.mimetype ?? "application/octet-stream",
        }),
        obj.created_at ?? null,
        obj.updated_at ?? null,
      ],
    );
    const file = join(storageRoot, bucket, ...obj.path.split("/"));
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  await db.query("COMMIT");
  console.log("\nImport complete.");
  console.log("Imported users have no password yet. Set one with:");
  for (const u of authUsers)
    console.log(`  npm run db:create-user -- ${u.email.toLowerCase()} "new-password"`);
} catch (error) {
  await db.query("ROLLBACK").catch(() => {});
  console.error(`\nImport failed, nothing was changed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.end();
}
