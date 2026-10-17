import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DbResult, QuerySpec } from "./query-builder";

// Runs `supabase.from(...)` / `supabase.rpc(...)` calls made from browser code.
// Like PostgREST did on Supabase, the query executes as `authenticated`
// (auth.uid() = the session user) or `anon`, so the tables' GRANTs and RLS
// policies decide what's allowed — never as the owner/service role.

const filterSchema = z.object({
  column: z.string(),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "in", "is", "like", "ilike"]),
  value: z.unknown(),
});

const specSchema = z.object({
  table: z.string().max(63),
  action: z.enum(["select", "insert", "update", "upsert", "delete"]),
  columns: z.string().max(2000).optional(),
  values: z.union([z.record(z.unknown()), z.array(z.record(z.unknown()))]).optional(),
  filters: z.array(filterSchema).max(50),
  order: z
    .array(
      z.object({ column: z.string(), ascending: z.boolean(), nullsFirst: z.boolean().optional() }),
    )
    .max(10),
  limit: z.number().int().min(0).max(10000).optional(),
  single: z.enum(["single", "maybeSingle"]).optional(),
  count: z.literal("exact").optional(),
  head: z.boolean().optional(),
  onConflict: z.string().max(500).optional(),
  ignoreDuplicates: z.boolean().optional(),
});

async function callerRole() {
  const { getCurrentUser } = await import("@/lib/auth/auth.server");
  const user = await getCurrentUser();
  return user ? ({ kind: "user", userId: user.id } as const) : ({ kind: "anon" } as const);
}

export const runClientQuery = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => specSchema.parse(input) as QuerySpec)
  .handler(async ({ data }): Promise<DbResult> => {
    const { executeSpec } = await import("./sql.server");
    return executeSpec(await callerRole(), data);
  });

export const runClientRpc = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ fn: z.string().max(63), args: z.record(z.unknown()) }).parse(input),
  )
  .handler(async ({ data }): Promise<DbResult> => {
    const { executeRpc } = await import("./sql.server");
    return executeRpc(await callerRole(), data.fn, data.args);
  });
