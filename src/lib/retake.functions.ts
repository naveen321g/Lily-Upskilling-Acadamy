import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit } from "./admin.server";
import { notifyAdmins } from "./notifications.server";
import type { AdminRetakeRequest, MyRetakeRequest } from "./retake-shared";
import {
  createRetakeRequest,
  listMyRetakeRequestsRows,
  listRetakeRequestsAdmin,
  reviewRetakeRequestAdmin,
} from "./retake.server";

export const requestRetake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid(),
        level: z.enum(["beginner", "expert"]),
        reason: z.string().trim().min(10).max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const created = await createRetakeRequest(context.supabase, context.userId, data);
    await notifyAdmins({
      type: "retake_request.new",
      title: "New retake request submitted",
      body: `A candidate is requesting another attempt on a ${data.level} assessment.`,
      targetType: "retake_request",
      targetId: created.id,
    });
    return created;
  });

export const listMyRetakeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRetakeRequest[]> => {
    return listMyRetakeRequestsRows(context.supabase, context.userId);
  });

export const listRetakeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminRetakeRequest[]> => {
    await assertAdmin(context.supabase, context.userId);
    return listRetakeRequestsAdmin(context.supabase);
  });

export const reviewRetakeRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        requestId: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        adminNotes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    await reviewRetakeRequestAdmin(context.supabase, {
      requestId: data.requestId,
      decision: data.decision,
      adminNotes: data.adminNotes?.trim() || null,
      reviewerId: context.userId,
    });
    await logAudit(
      context.supabase,
      context.userId,
      data.decision === "approved" ? "retake_request.approve" : "retake_request.reject",
      "retake_request",
      data.requestId,
      {},
    );
    return { ok: true };
  });
