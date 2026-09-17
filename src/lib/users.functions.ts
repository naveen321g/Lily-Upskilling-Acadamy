import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit } from "./admin.server";
import type { AdminUserDetail, AdminUserSummary } from "./users-shared";
import {
  getUserDetailAdmin,
  listUsersAdmin,
  setUserBannedAdmin,
  setUserRoleAdmin,
} from "./users.server";

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminUserSummary[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listUsersAdmin(data.search);
  });

export const getUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminUserDetail | null> => {
    await assertAdmin(context.supabase, context.userId);
    return getUserDetailAdmin(data.userId);
  });

export const setUserBanned = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), banned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You can't suspend your own account.");
    await setUserBannedAdmin(data.userId, data.banned);
    await logAudit(
      context.supabase,
      context.userId,
      data.banned ? "user.suspend" : "user.unsuspend",
      "user",
      data.userId,
      {},
    );
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "reviewer"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You can't remove your own admin access.");
    }
    await setUserRoleAdmin(data.userId, data.role, data.grant);
    await logAudit(
      context.supabase,
      context.userId,
      data.grant ? "role.grant" : "role.revoke",
      "user",
      data.userId,
      { role: data.role },
    );
    return { ok: true };
  });
