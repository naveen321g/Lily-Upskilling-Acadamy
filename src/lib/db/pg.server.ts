// PostgreSQL connection pool + role switching. Server-only.
import pg from "pg";

// Return values in the same shapes PostgREST (supabase-js) did, so existing
// code that does `String(row.created_at)` / arithmetic on numerics keeps working:
// timestamps as ISO strings, numeric/bigint as JS numbers.
const toIso = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString(); // e.g. 'infinity'
};
pg.types.setTypeParser(1184, toIso); // timestamptz
pg.types.setTypeParser(1114, (v) => toIso(`${v}Z`)); // timestamp (no tz) — treat as UTC
pg.types.setTypeParser(1082, (v) => v); // date — keep "YYYY-MM-DD"
pg.types.setTypeParser(1700, (v) => Number(v)); // numeric
pg.types.setTypeParser(20, (v) => Number(v)); // int8 / bigint (e.g. count(*))

let _pool: pg.Pool | undefined;

export function getPool(): pg.Pool {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      const message =
        "Missing DATABASE_URL environment variable. Add it to .env, e.g. postgresql://postgres:PASSWORD@localhost:5432/lua";
      console.error(`[db] ${message}`);
      throw new Error(message);
    }
    _pool = new pg.Pool({ connectionString, max: 10 });
    _pool.on("error", (error) => console.error("[db] idle client error", error));
  }
  return _pool;
}

/**
 * Who a query runs as:
 * - `service`: the connecting (owner) role — bypasses RLS, like Supabase's service_role.
 * - `user`: `authenticated` with auth.uid() = userId — RLS policies apply.
 * - `anon`: signed-out visitor — RLS policies for `anon` apply.
 */
export type DbRole = { kind: "service" } | { kind: "user"; userId: string } | { kind: "anon" };

export async function withRole<T>(
  role: DbRole,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (role.kind === "user") {
      await client.query("SET LOCAL ROLE authenticated");
      await client.query(
        "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)",
        [role.userId],
      );
    } else if (role.kind === "anon") {
      await client.query("SET LOCAL ROLE anon");
      await client.query("SELECT set_config('request.jwt.claim.role', 'anon', true)");
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
