// Compiles a QuerySpec (query-builder.ts) to SQL and runs it. Server-only.
//
// Mirrors PostgREST's behaviour for the features this app uses: column
// lists, embedded relations via foreign keys (`skills(name)`), filters,
// ordering, limit, single/maybeSingle, exact head counts, insert/update/
// upsert/delete with optional RETURNING, and rpc() calls. Errors are
// returned as `{ data: null, error }` (never thrown), like supabase-js.
import type pg from "pg";
import { getPool, withRole, type DbRole } from "./pg.server";
import {
  createDbClient,
  type DbClient,
  type DbError,
  type DbResult,
  type QueryFilter,
  type QuerySpec,
} from "./query-builder";

// ============ SCHEMA METADATA ============

type ForeignKey = { srcTable: string; srcCols: string[]; tgtTable: string; tgtCols: string[] };
type TableInfo = { columns: Map<string, string>; primaryKey: string[] };
type SchemaInfo = { tables: Map<string, TableInfo>; foreignKeys: ForeignKey[] };

let _schema: Promise<SchemaInfo> | undefined;

async function loadSchema(): Promise<SchemaInfo> {
  const pool = getPool();
  const [columns, pks, fks] = await Promise.all([
    pool.query<{ table_name: string; column_name: string; type_name: string }>(`
      SELECT c.relname AS table_name, a.attname AS column_name, t.typname AS type_name
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_type t ON t.oid = a.atttypid
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v', 'm', 'p')
        AND a.attnum > 0 AND NOT a.attisdropped`),
    pool.query<{ table_name: string; column_name: string }>(`
      SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = 'public' AND i.indisprimary`),
    pool.query<{ src_table: string; src_cols: string[]; tgt_table: string; tgt_cols: string[] }>(`
      SELECT src.relname AS src_table, tgt.relname AS tgt_table,
             array_agg(sa.attname::text ORDER BY k.ord) AS src_cols,
             array_agg(ta.attname::text ORDER BY k.ord) AS tgt_cols
      FROM pg_constraint con
      JOIN pg_class src ON src.oid = con.conrelid
      JOIN pg_namespace sn ON sn.oid = src.relnamespace
      JOIN pg_class tgt ON tgt.oid = con.confrelid
      JOIN pg_namespace tn ON tn.oid = tgt.relnamespace
      CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(src_att, tgt_att, ord)
      JOIN pg_attribute sa ON sa.attrelid = con.conrelid AND sa.attnum = k.src_att
      JOIN pg_attribute ta ON ta.attrelid = con.confrelid AND ta.attnum = k.tgt_att
      WHERE con.contype = 'f' AND sn.nspname = 'public' AND tn.nspname = 'public'
      GROUP BY con.oid, src.relname, tgt.relname`),
  ]);

  const tables = new Map<string, TableInfo>();
  for (const row of columns.rows) {
    let info = tables.get(row.table_name);
    if (!info) tables.set(row.table_name, (info = { columns: new Map(), primaryKey: [] }));
    info.columns.set(row.column_name, row.type_name);
  }
  for (const row of pks.rows) tables.get(row.table_name)?.primaryKey.push(row.column_name);
  const foreignKeys = fks.rows.map((r) => ({
    srcTable: r.src_table,
    srcCols: r.src_cols,
    tgtTable: r.tgt_table,
    tgtCols: r.tgt_cols,
  }));
  return { tables, foreignKeys };
}

async function getSchema(table?: string): Promise<SchemaInfo> {
  if (!_schema) _schema = loadSchema().catch((e) => ((_schema = undefined), Promise.reject(e)));
  let schema = await _schema;
  // A migration may have added the table since we cached — reload once.
  if (table && !schema.tables.has(table)) {
    _schema = loadSchema();
    schema = await _schema;
  }
  return schema;
}

class QueryError extends Error {
  constructor(
    message: string,
    readonly code = "PGRST100",
  ) {
    super(message);
  }
}

// ============ COMPILER ============

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function ident(name: string): string {
  if (!IDENT.test(name)) throw new QueryError(`Invalid identifier: ${JSON.stringify(name)}`);
  return `"${name}"`;
}

function tableInfo(schema: SchemaInfo, table: string): TableInfo {
  const info = schema.tables.get(table);
  if (!info) {
    throw new QueryError(
      `Could not find the table 'public.${table}' in the schema cache`,
      "PGRST205",
    );
  }
  return info;
}

class Params {
  values: unknown[] = [];
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }
}

type SelectItem =
  | { kind: "star" }
  | { kind: "column"; name: string; alias?: string }
  | { kind: "embed"; relation: string; alias?: string; items: SelectItem[] };

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseSelect(input: string): SelectItem[] {
  return splitTopLevel(input).map((part): SelectItem => {
    if (part === "*") return { kind: "star" };
    const embed = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)$/.exec(
      part,
    );
    if (embed) {
      return {
        kind: "embed",
        alias: embed[1],
        relation: embed[2],
        items: parseSelect(embed[3] || "*"),
      };
    }
    const column = /^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)$/.exec(part);
    if (!column) throw new QueryError(`Unsupported select item: ${JSON.stringify(part)}`);
    return { kind: "column", alias: column[1], name: column[2] };
  });
}

let aliasCounter = 0;

/** Compile a select list against table `table` aliased as `alias`. */
function compileSelectList(
  schema: SchemaInfo,
  table: string,
  alias: string,
  items: SelectItem[],
): string {
  const info = tableInfo(schema, table);
  return items
    .map((item) => {
      if (item.kind === "star") return `${alias}.*`;
      if (item.kind === "column") {
        if (!info.columns.has(item.name)) {
          throw new QueryError(`column ${table}.${item.name} does not exist`, "42703");
        }
        return `${alias}.${ident(item.name)} AS ${ident(item.alias ?? item.name)}`;
      }
      return `${compileEmbed(schema, table, alias, item)} AS ${ident(item.alias ?? item.relation)}`;
    })
    .join(", ");
}

function compileEmbed(
  schema: SchemaInfo,
  parentTable: string,
  parentAlias: string,
  item: Extract<SelectItem, { kind: "embed" }>,
): string {
  const relationInfo = tableInfo(schema, item.relation);
  const childAlias = `_e${++aliasCounter}`;
  // PostgREST aggregate: `rel(count)` -> [{ count: N }] (or { count: N } for to-one).
  const isCount =
    item.items.length === 1 &&
    item.items[0].kind === "column" &&
    item.items[0].name === "count" &&
    !relationInfo.columns.has("count");
  const inner = isCount ? "" : compileSelectList(schema, item.relation, childAlias, item.items);
  const join = (srcAlias: string, srcCols: string[], tgtAlias: string, tgtCols: string[]) =>
    srcCols
      .map((c, i) => `${srcAlias}.${ident(c)} = ${tgtAlias}.${ident(tgtCols[i])}`)
      .join(" AND ");

  // Many-to-one: parent has a FK to the relation -> a single object (or null).
  const toOne = schema.foreignKeys.filter(
    (fk) => fk.srcTable === parentTable && fk.tgtTable === item.relation,
  );
  if (toOne.length === 1) {
    const fk = toOne[0];
    if (isCount) {
      return `(SELECT jsonb_build_object('count', count(*)) FROM public.${ident(item.relation)} AS ${childAlias} WHERE ${join(childAlias, fk.tgtCols, parentAlias, fk.srcCols)})`;
    }
    return `(SELECT to_jsonb(_r) FROM (SELECT ${inner} FROM public.${ident(item.relation)} AS ${childAlias} WHERE ${join(childAlias, fk.tgtCols, parentAlias, fk.srcCols)} LIMIT 1) AS _r)`;
  }
  // One-to-many: the relation has a FK to parent -> an array.
  const toMany = schema.foreignKeys.filter(
    (fk) => fk.srcTable === item.relation && fk.tgtTable === parentTable,
  );
  if (toMany.length === 1) {
    const fk = toMany[0];
    if (isCount) {
      return `(SELECT jsonb_build_array(jsonb_build_object('count', count(*))) FROM public.${ident(item.relation)} AS ${childAlias} WHERE ${join(childAlias, fk.srcCols, parentAlias, fk.tgtCols)})`;
    }
    return `(SELECT coalesce(jsonb_agg(_r), '[]'::jsonb) FROM (SELECT ${inner} FROM public.${ident(item.relation)} AS ${childAlias} WHERE ${join(childAlias, fk.srcCols, parentAlias, fk.tgtCols)}) AS _r)`;
  }
  throw new QueryError(
    `Could not find a single relationship between '${parentTable}' and '${item.relation}'`,
    "PGRST200",
  );
}

function compileFilters(
  info: TableInfo,
  table: string,
  alias: string,
  filters: QueryFilter[],
  params: Params,
): string {
  if (!filters.length) return "";
  const clauses = filters.map(({ column, op, value }) => {
    if (!info.columns.has(column))
      throw new QueryError(`column ${table}.${column} does not exist`, "42703");
    const col = `${alias}.${ident(column)}`;
    switch (op) {
      case "eq":
        return `${col} = ${params.add(value)}`;
      case "neq":
        return `${col} <> ${params.add(value)}`;
      case "gt":
        return `${col} > ${params.add(value)}`;
      case "gte":
        return `${col} >= ${params.add(value)}`;
      case "lt":
        return `${col} < ${params.add(value)}`;
      case "lte":
        return `${col} <= ${params.add(value)}`;
      case "like":
        return `${col} LIKE ${params.add(value)}`;
      case "ilike":
        return `${col} ILIKE ${params.add(value)}`;
      case "in":
        if (!Array.isArray(value)) throw new QueryError("in() expects an array");
        return value.length ? `${col} = ANY(${params.add(value)})` : "false";
      case "is":
        if (value === null) return `${col} IS NULL`;
        if (value === true) return `${col} IS TRUE`;
        if (value === false) return `${col} IS FALSE`;
        throw new QueryError("is() expects null, true or false");
      default:
        throw new QueryError(`Unsupported filter operator: ${String(op)}`);
    }
  });
  return ` WHERE ${clauses.join(" AND ")}`;
}

/** json/jsonb columns must be sent as JSON text; pg would turn JS arrays into Postgres arrays. */
function encodeValue(info: TableInfo, column: string, value: unknown): unknown {
  const type = info.columns.get(column);
  if ((type === "json" || type === "jsonb") && value !== null && value !== undefined) {
    return JSON.stringify(value);
  }
  return value;
}

function definedKeys(row: Record<string, unknown>): string[] {
  return Object.keys(row).filter((k) => row[k] !== undefined);
}

function compileWrite(schema: SchemaInfo, spec: QuerySpec, params: Params): string {
  // Like PostgREST's return=minimal: only RETURNING (which needs SELECT rights) when `.select()` was chained.
  const returning = spec.columns === undefined ? "" : " RETURNING t.*";
  const info = tableInfo(schema, spec.table);
  const target = `public.${ident(spec.table)} AS t`;
  const checkColumn = (c: string) => {
    if (!info.columns.has(c))
      throw new QueryError(`Could not find the '${c}' column of '${spec.table}'`, "PGRST204");
  };

  if (spec.action === "delete") {
    return `DELETE FROM ${target}${compileFilters(info, spec.table, "t", spec.filters, params)}${returning}`;
  }

  if (spec.action === "update") {
    const values = (spec.values ?? {}) as Record<string, unknown>;
    const keys = definedKeys(values);
    keys.forEach(checkColumn);
    if (!keys.length) throw new QueryError("update() needs at least one column");
    const sets = keys.map((k) => `${ident(k)} = ${params.add(encodeValue(info, k, values[k]))}`);
    return `UPDATE ${target} SET ${sets.join(", ")}${compileFilters(info, spec.table, "t", spec.filters, params)}${returning}`;
  }

  // insert / upsert
  const rows = (Array.isArray(spec.values) ? spec.values : [spec.values ?? {}]) as Record<
    string,
    unknown
  >[];
  if (!rows.length) throw new QueryError("insert() needs at least one row");
  const keys = Array.from(new Set(rows.flatMap(definedKeys)));
  keys.forEach(checkColumn);
  const tuples = rows.map(
    (row) =>
      `(${keys.map((k) => (row[k] === undefined ? "DEFAULT" : params.add(encodeValue(info, k, row[k])))).join(", ")})`,
  );
  let sql = keys.length
    ? `INSERT INTO ${target} (${keys.map(ident).join(", ")}) VALUES ${tuples.join(", ")}`
    : `INSERT INTO ${target} DEFAULT VALUES`;

  if (spec.action === "upsert") {
    const conflict = spec.onConflict
      ? spec.onConflict
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : info.primaryKey;
    if (!conflict.length) throw new QueryError(`upsert() on '${spec.table}' needs onConflict`);
    conflict.forEach(checkColumn);
    const updates = keys.filter((k) => !conflict.includes(k));
    sql +=
      spec.ignoreDuplicates || !updates.length
        ? ` ON CONFLICT (${conflict.map(ident).join(", ")}) DO NOTHING`
        : ` ON CONFLICT (${conflict.map(ident).join(", ")}) DO UPDATE SET ${updates.map((k) => `${ident(k)} = EXCLUDED.${ident(k)}`).join(", ")}`;
  }
  return `${sql}${returning}`;
}

function compileOrderLimit(info: TableInfo, spec: QuerySpec, alias: string): string {
  let sql = "";
  if (spec.order.length) {
    sql += ` ORDER BY ${spec.order
      .map((o) => {
        if (!info.columns.has(o.column))
          throw new QueryError(`column ${spec.table}.${o.column} does not exist`, "42703");
        const nulls =
          o.nullsFirst === undefined ? "" : o.nullsFirst ? " NULLS FIRST" : " NULLS LAST";
        return `${alias}.${ident(o.column)} ${o.ascending ? "ASC" : "DESC"}${nulls}`;
      })
      .join(", ")}`;
  }
  if (spec.limit !== undefined) sql += ` LIMIT ${Math.max(0, Math.floor(Number(spec.limit)))}`;
  return sql;
}

// ============ EXECUTION ============

function toDbError(error: unknown): DbError {
  if (error instanceof QueryError)
    return { message: error.message, code: error.code, details: null, hint: null };
  const e = error as { message?: string; code?: string; detail?: string; hint?: string };
  return {
    message: e?.message ?? String(error),
    code: e?.code,
    details: e?.detail ?? null,
    hint: e?.hint ?? null,
  };
}

function applySingle(spec: QuerySpec, rows: unknown[]): DbResult {
  if (!spec.single) return { data: rows, error: null, count: null };
  if (rows.length === 1) return { data: rows[0], error: null, count: null };
  if (rows.length === 0 && spec.single === "maybeSingle")
    return { data: null, error: null, count: null };
  return {
    data: null,
    error: {
      code: "PGRST116",
      message: "JSON object requested, multiple (or no) rows returned",
      details: `The result contains ${rows.length} rows`,
      hint: null,
    },
    count: null,
  };
}

async function runSpec(
  client: pg.PoolClient,
  schema: SchemaInfo,
  spec: QuerySpec,
): Promise<DbResult> {
  const info = tableInfo(schema, spec.table);

  if (spec.action === "select") {
    const params = new Params();
    const where = compileFilters(info, spec.table, "t", spec.filters, params);
    let count: number | null = null;
    if (spec.count) {
      const { rows } = await client.query<{ count: number }>(
        `SELECT count(*) AS count FROM public.${ident(spec.table)} AS t${where}`,
        params.values,
      );
      count = Number(rows[0]?.count ?? 0);
      if (spec.head) return { data: null, error: null, count };
    }
    const list = compileSelectList(schema, spec.table, "t", parseSelect(spec.columns ?? "*"));
    const { rows } = await client.query(
      `SELECT ${list} FROM public.${ident(spec.table)} AS t${where}${compileOrderLimit(info, spec, "t")}`,
      params.values,
    );
    return { ...applySingle(spec, rows), count };
  }

  const params = new Params();
  const write = compileWrite(schema, spec, params);
  if (spec.columns === undefined) {
    await client.query(write, params.values);
    return { data: null, error: null, count: null };
  }
  // `.select(...)` after a write: shape the returned rows like a normal select.
  const list = compileSelectList(schema, spec.table, "t", parseSelect(spec.columns));
  const { rows } = await client.query(
    `WITH _w AS (${write}) SELECT ${list} FROM _w AS t${compileOrderLimit(info, spec, "t")}`,
    params.values,
  );
  return applySingle(spec, rows);
}

export async function executeSpec(role: DbRole, spec: QuerySpec): Promise<DbResult> {
  try {
    if (!IDENT.test(spec.table))
      throw new QueryError(`Invalid table name: ${JSON.stringify(spec.table)}`);
    const schema = await getSchema(spec.table);
    return await withRole(role, (client) => runSpec(client, schema, spec));
  } catch (error) {
    return { data: null, error: toDbError(error), count: null };
  }
}

export async function executeRpc(
  role: DbRole,
  fn: string,
  args: Record<string, unknown>,
): Promise<DbResult> {
  try {
    const params = new Params();
    const named = Object.entries(args).map(([k, v]) => `${ident(k)} => ${params.add(v)}`);
    const { rows } = await withRole(role, (client) =>
      client.query(`SELECT public.${ident(fn)}(${named.join(", ")}) AS result`, params.values),
    );
    return { data: rows[0]?.result ?? null, error: null, count: null };
  } catch (error) {
    return { data: null, error: toDbError(error), count: null };
  }
}

export function createServerDbClient(role: DbRole): DbClient {
  return createDbClient(
    (spec) => executeSpec(role, spec),
    (fn, args) => executeRpc(role, fn, args),
  );
}
