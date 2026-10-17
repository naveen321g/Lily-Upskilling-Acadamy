// A small, supabase-js-compatible query builder.
//
// It implements exactly the subset of the `supabase.from(...)` / `.rpc(...)`
// API this codebase uses, so the existing query code keeps working
// unchanged on top of plain PostgreSQL. It only *describes* a query (a
// serialisable `QuerySpec`); an injected executor runs it:
//   - on the server, `executeSpec` in sql.server.ts compiles it to SQL;
//   - in the browser, it's sent to the `runClientQuery` server function,
//     which executes it under the caller's RLS role (like PostgREST did).
//
// Isomorphic: no server-only imports here.

export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "like" | "ilike";

export type QueryFilter = { column: string; op: FilterOp; value: unknown };

export type QuerySpec = {
  table: string;
  action: "select" | "insert" | "update" | "upsert" | "delete";
  /** Select list (PostgREST syntax, e.g. "id, name, skills(name)"). For writes: the RETURNING list, if `.select()` was chained. */
  columns?: string;
  values?: Record<string, unknown> | Record<string, unknown>[];
  filters: QueryFilter[];
  order: { column: string; ascending: boolean; nullsFirst?: boolean }[];
  limit?: number;
  single?: "single" | "maybeSingle";
  count?: "exact";
  head?: boolean;
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

export type DbError = {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
/** A row as returned to callers — loosely typed, like the untyped supabase-js client. */
export type Row = Record<string, any>;

/** Same discriminated shape as supabase-js: `if (error) throw ...` narrows `data` to T. */
export type DbResult<T = any> =
  | { data: T; error: null; count: number | null }
  | { data: null; error: DbError; count: number | null };

export type SpecExecutor = (spec: QuerySpec) => Promise<DbResult>;
export type RpcExecutor = (fn: string, args: Record<string, unknown>) => Promise<DbResult>;

export class QueryBuilder<T = Row[]> implements PromiseLike<DbResult<T>> {
  private spec: QuerySpec;

  constructor(
    table: string,
    private readonly executor: SpecExecutor,
  ) {
    this.spec = { table, action: "select", filters: [], order: [] };
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    // After insert/update/upsert/delete, `.select()` means "return the rows".
    this.spec.columns = columns;
    if (options?.count) this.spec.count = options.count;
    if (options?.head) this.spec.head = true;
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.spec.action = "insert";
    this.spec.values = values;
    this.spec.columns = undefined;
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): this {
    this.spec.action = "upsert";
    this.spec.values = values;
    this.spec.columns = undefined;
    this.spec.onConflict = options?.onConflict;
    this.spec.ignoreDuplicates = options?.ignoreDuplicates;
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.spec.action = "update";
    this.spec.values = values;
    this.spec.columns = undefined;
    return this;
  }

  delete(): this {
    this.spec.action = "delete";
    this.spec.columns = undefined;
    return this;
  }

  private filter(column: string, op: FilterOp, value: unknown): this {
    this.spec.filters.push({ column, op, value });
    return this;
  }

  eq(column: string, value: unknown) {
    return this.filter(column, "eq", value);
  }
  neq(column: string, value: unknown) {
    return this.filter(column, "neq", value);
  }
  gt(column: string, value: unknown) {
    return this.filter(column, "gt", value);
  }
  gte(column: string, value: unknown) {
    return this.filter(column, "gte", value);
  }
  lt(column: string, value: unknown) {
    return this.filter(column, "lt", value);
  }
  lte(column: string, value: unknown) {
    return this.filter(column, "lte", value);
  }
  in(column: string, values: readonly unknown[]) {
    return this.filter(column, "in", [...values]);
  }
  is(column: string, value: null | boolean) {
    return this.filter(column, "is", value);
  }
  like(column: string, pattern: string) {
    return this.filter(column, "like", pattern);
  }
  ilike(column: string, pattern: string) {
    return this.filter(column, "ilike", pattern);
  }
  match(query: Record<string, unknown>) {
    for (const [column, value] of Object.entries(query)) this.eq(column, value);
    return this;
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.spec.order.push({
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst,
    });
    return this;
  }

  limit(count: number) {
    this.spec.limit = count;
    return this;
  }

  single(): QueryBuilder<Row> {
    this.spec.single = "single";
    return this as unknown as QueryBuilder<Row>;
  }

  maybeSingle(): QueryBuilder<Row | null> {
    this.spec.single = "maybeSingle";
    return this as unknown as QueryBuilder<Row | null>;
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.executor(this.spec).then(onfulfilled as any, onrejected) as Promise<R1 | R2>;
  }
}

export type DbClient = {
  from: (table: string) => QueryBuilder;
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<DbResult<any>>;
};

export function createDbClient(executor: SpecExecutor, rpcExecutor: RpcExecutor): DbClient {
  return {
    from: (table) => new QueryBuilder(table, executor),
    rpc: (fn, args = {}) => rpcExecutor(fn, args),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */
