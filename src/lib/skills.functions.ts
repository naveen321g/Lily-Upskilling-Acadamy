import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { MySkillEntry, MySkillRequest } from "./skills-shared";
import {
  addSkillToProfile,
  createSkillRequest,
  getMySkillRequests,
  getMySkills,
  removeSkillFromProfile,
} from "./skills.server";
import { notifyAdmins } from "./notifications.server";

export const listMySkills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySkillEntry[]> => {
    return getMySkills(context.supabase, context.userId);
  });

export const addMySkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ skillId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await addSkillToProfile(context.supabase, context.userId, data.skillId);
    return { ok: true };
  });

export const removeMySkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ skillId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await removeSkillFromProfile(context.supabase, context.userId, data.skillId);
    return { ok: true };
  });

export const requestNewSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(100),
        category: z.string().trim().max(60).optional(),
        notes: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const created = await createSkillRequest(context.supabase, context.userId, data);
    await notifyAdmins({
      type: "skill_request.new",
      title: "New skill request submitted",
      body: `A candidate requested "${data.name}" be added to the catalog.`,
      targetType: "skill_request",
      targetId: created.id,
    });
    return created;
  });

export const listMySkillRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MySkillRequest[]> => {
    return getMySkillRequests(context.supabase, context.userId);
  });
