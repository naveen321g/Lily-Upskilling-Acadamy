import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit } from "./admin.server";
import type { AdminBadgeAppeal } from "./admin-shared";
import type { AdminBadgeRecord, MyBadge, MyBadgeAppeal } from "./badges-shared";
import { notifyAdmins } from "./notifications.server";
import {
  createBadgeAppeal,
  listBadgeAppealsAdmin,
  listBadgesAdmin,
  listMyBadgeAppealsRows,
  listMyBadgesRows,
  reissueBadgeAdmin,
  revokeBadgeAdmin,
  reviewBadgeAppealAdmin,
} from "./badges.server";

export const listBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBadgeRecord[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listBadgesAdmin();
  });

export const listMyBadges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBadge[]> => {
    return listMyBadgesRows(context.supabase, context.userId);
  });

export const revokeBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ badgeId: z.string().uuid(), reason: z.string().max(500).optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    await revokeBadgeAdmin(data.badgeId, context.userId, data.reason?.trim() || null);
    await logAudit(context.supabase, context.userId, "badge.revoke", "badge", data.badgeId, {
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

export const reissueBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ badgeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    await reissueBadgeAdmin(data.badgeId);
    await logAudit(context.supabase, context.userId, "badge.reissue", "badge", data.badgeId, {});
    return { ok: true };
  });

export const appealBadge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ badgeId: z.string().uuid(), reason: z.string().trim().min(10).max(1000) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const created = await createBadgeAppeal(
      context.supabase,
      context.userId,
      data.badgeId,
      data.reason,
    );
    await notifyAdmins({
      type: "badge_appeal.new",
      title: "New badge appeal submitted",
      body: "A candidate is disputing a revoked badge.",
      targetType: "badge_appeal",
      targetId: created.id,
    });
    return created;
  });

export const listMyBadgeAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyBadgeAppeal[]> => {
    return listMyBadgeAppealsRows(context.supabase, context.userId);
  });

export const listBadgeAppeals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminBadgeAppeal[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listBadgeAppealsAdmin();
  });

export const reviewBadgeAppeal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        appealId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        adminNotes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    await reviewBadgeAppealAdmin({
      appealId: data.appealId,
      decision: data.decision,
      adminNotes: data.adminNotes?.trim() || null,
      reviewerId: context.userId,
    });
    await logAudit(
      context.supabase,
      context.userId,
      data.decision === "approved" ? "badge_appeal.approve" : "badge_appeal.reject",
      "badge_appeal",
      data.appealId,
      {},
    );
    return { ok: true };
  });
