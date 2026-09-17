import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { levelFromString } from "./assessment-shared";
import type {
  AdminAttemptRecord,
  AdminAuditLogEntry,
  AdminQuestion,
  AdminSkillOption,
  AdminSkillRecord,
  AdminSkillRequest,
  GeneratedQuestion,
  QuestionBankStats,
} from "./admin-shared";
import { assertAdmin, generateQuestionsWithAi, logAudit } from "./admin.server";

// `skill_requests` was added by a hand-written migration and isn't in the
// generated Database type yet — same situation as admin_audit_log/badges.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

const levelEnum = z.enum(["beginner", "expert"]);
const statusEnum = z.enum(["draft", "published", "archived"]);

function toAdminQuestion(row: {
  id: string;
  skill_id: string;
  level: string;
  kind: string;
  prompt: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
  status: string;
  source: string;
  created_at: string;
  skills?: { name: string } | null;
}): AdminQuestion {
  return {
    id: row.id,
    skillId: row.skill_id,
    skillName: row.skills?.name ?? "Skill",
    level: levelFromString(row.level),
    kind: row.kind,
    prompt: row.prompt,
    options: Array.isArray(row.options) ? row.options.map((o) => String(o)) : [],
    correctIndex: row.correct_index,
    explanation: row.explanation,
    status: (row.status as AdminQuestion["status"]) ?? "draft",
    source: row.source,
    createdAt: row.created_at,
  };
}

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: data === true };
  });

export const listQuestionBank = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid().optional(),
        level: levelEnum.optional(),
        status: statusEnum.optional(),
        search: z.string().max(200).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      questions: AdminQuestion[];
      stats: QuestionBankStats;
      skills: AdminSkillOption[];
    }> => {
      await assertAdmin(context.supabase, context.userId);
      const db = context.supabase;

      let query = db
        .from("questions")
        .select(
          "id, skill_id, level, kind, prompt, options, correct_index, explanation, status, source, created_at, skills(name)",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (data.skillId) query = query.eq("skill_id", data.skillId);
      if (data.level) query = query.eq("level", data.level);
      if (data.status) query = query.eq("status", data.status);
      if (data.search?.trim()) query = query.ilike("prompt", `%${data.search.trim()}%`);

      const [questionsRes, allRes, skillsRes] = await Promise.all([
        query,
        db.from("questions").select("skill_id, level, status, source"),
        db.from("skills").select("id, name, category").eq("is_active", true).order("name"),
      ]);
      if (questionsRes.error) throw new Error(questionsRes.error.message);

      const all = allRes.data ?? [];
      const stats: QuestionBankStats = {
        total: all.length,
        published: all.filter((q) => q.status === "published").length,
        draft: all.filter((q) => q.status === "draft").length,
        aiGenerated: all.filter((q) => q.source === "ai").length,
      };

      const skills: AdminSkillOption[] = (skillsRes.data ?? []).map((s) => {
        const mine = all.filter((q) => q.skill_id === s.id);
        return {
          id: s.id,
          name: s.name,
          category: s.category,
          beginnerPublished: mine.filter((q) => q.level === "beginner" && q.status === "published")
            .length,
          expertPublished: mine.filter((q) => q.level === "expert" && q.status === "published")
            .length,
          drafts: mine.filter((q) => q.status === "draft").length,
        };
      });

      return {
        questions: (questionsRes.data ?? []).map((r) =>
          toAdminQuestion(r as Parameters<typeof toAdminQuestion>[0]),
        ),
        stats,
        skills,
      };
    },
  );

const questionInput = z.object({
  id: z.string().uuid().optional(),
  skillId: z.string().uuid(),
  level: levelEnum,
  prompt: z.string().min(8).max(1000),
  options: z.array(z.string().min(1).max(400)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().max(1000).optional(),
  status: statusEnum,
});

export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => questionInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertAdmin(context.supabase, context.userId);
    if (data.correctIndex >= data.options.length) {
      throw new Error("The correct answer must be one of the options.");
    }
    const payload = {
      skill_id: data.skillId,
      level: data.level,
      kind: "mcq",
      prompt: data.prompt.trim(),
      options: data.options,
      correct_index: data.correctIndex,
      explanation: data.explanation?.trim() || null,
      status: data.status,
    };

    if (data.id) {
      const { error } = await context.supabase.from("questions").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context.supabase, context.userId, "question.update", "question", data.id, {
        status: data.status,
      });
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("questions")
      .insert({ ...payload, source: "manual", created_by: context.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "question.create", "question", created.id, {
      status: data.status,
    });
    return { id: created.id };
  });

export const setQuestionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200), status: statusEnum }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ updated: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("questions")
      .update({ status: data.status })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "question.setStatus", "question", null, {
      ids: data.ids,
      status: data.status,
    });
    return { updated: data.ids.length };
  });

export const deleteQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ deleted: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("questions").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "question.delete", "question", null, {
      ids: data.ids,
    });
    return { deleted: data.ids.length };
  });

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid(),
        level: levelEnum,
        count: z.number().int().min(1).max(15),
        topics: z.string().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ questions: GeneratedQuestion[] }> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: skill, error } = await context.supabase
      .from("skills")
      .select("name, category")
      .eq("id", data.skillId)
      .single();
    if (error || !skill) throw new Error("Skill not found.");

    const { data: existing } = await context.supabase
      .from("questions")
      .select("prompt")
      .eq("skill_id", data.skillId)
      .eq("level", data.level)
      .limit(40);

    const questions = await generateQuestionsWithAi({
      skillName: skill.name,
      category: skill.category,
      level: data.level,
      count: data.count,
      topics: data.topics,
      existingPrompts: (existing ?? []).map((q) => q.prompt),
    });
    return { questions };
  });

export const saveGeneratedQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid(),
        level: levelEnum,
        status: statusEnum,
        questions: z
          .array(
            z.object({
              prompt: z.string().min(8).max(1000),
              options: z.array(z.string().min(1).max(400)).min(2).max(6),
              correctIndex: z.number().int().min(0).max(5),
              explanation: z.string().max(1000).optional(),
            }),
          )
          .min(1)
          .max(15),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ inserted: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const rows = data.questions.map((q) => ({
      skill_id: data.skillId,
      level: data.level,
      kind: "mcq",
      prompt: q.prompt.trim(),
      options: q.options,
      correct_index: Math.min(q.correctIndex, q.options.length - 1),
      explanation: q.explanation?.trim() || null,
      status: data.status,
      source: "ai",
      created_by: context.userId,
    }));
    const { error } = await context.supabase.from("questions").insert(rows);
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "question.bulkCreateAi", "question", null, {
      skillId: data.skillId,
      level: data.level,
      count: rows.length,
    });
    return { inserted: rows.length };
  });

function toAdminSkill(row: {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  icon_key: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}): AdminSkillRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    difficulty: row.difficulty,
    iconKey: row.icon_key,
    description: row.description,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export const listSkillsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSkillRecord[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("skills")
      .select("id, slug, name, category, difficulty, icon_key, description, is_active, created_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => toAdminSkill(r as Parameters<typeof toAdminSkill>[0]));
  });

const skillInput = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens only."),
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]),
  iconKey: z.string().trim().min(2).max(40),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean(),
});

export const saveSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => skillInput.parse(input))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertAdmin(context.supabase, context.userId);
    const payload = {
      slug: data.slug,
      name: data.name,
      category: data.category,
      difficulty: data.difficulty,
      icon_key: data.iconKey,
      description: data.description?.trim() || null,
      is_active: data.isActive,
    };

    if (data.id) {
      const { error } = await context.supabase.from("skills").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await logAudit(context.supabase, context.userId, "skill.update", "skill", data.id, {
        slug: data.slug,
      });
      return { id: data.id };
    }
    const { data: created, error } = await context.supabase
      .from("skills")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(context.supabase, context.userId, "skill.create", "skill", created.id, {
      slug: data.slug,
    });
    return { id: created.id };
  });

export const setSkillActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), isActive: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("skills")
      .update({ is_active: data.isActive })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      data.isActive ? "skill.activate" : "skill.deactivate",
      "skill",
      data.id,
      {},
    );
    return { ok: true };
  });

export const listSkillRequestsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminSkillRequest[]> => {
    await assertAdmin(context.supabase, context.userId);
    const db: LooseClient = context.supabase;
    const { data: rows, error } = await db
      .from("skill_requests")
      .select("id, user_id, name, category, notes, status, admin_notes, created_at, reviewed_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const userIds: string[] = Array.from(
      new Set((rows ?? []).map((r: { user_id: string }) => r.user_id)),
    );
    const { data: profiles } = userIds.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (rows ?? []).map((r: LooseClient) => ({
      id: r.id,
      userId: r.user_id,
      userName: nameById.get(r.user_id) ?? "Candidate",
      name: r.name,
      category: r.category,
      notes: r.notes,
      status: (r.status as AdminSkillRequest["status"]) ?? "pending",
      adminNotes: r.admin_notes,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }));
  });

export const reviewSkillRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        adminNotes: z.string().trim().max(500).optional(),
        resultingSkillId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const db: LooseClient = context.supabase;
    const { error } = await db
      .from("skill_requests")
      .update({
        status: data.decision,
        admin_notes: data.adminNotes?.trim() || null,
        resulting_skill_id: data.resultingSkillId ?? null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      data.decision === "approved" ? "skill_request.approve" : "skill_request.reject",
      "skill_request",
      data.id,
      { resultingSkillId: data.resultingSkillId ?? null },
    );
    return { ok: true };
  });

const PERIOD_DAYS: Record<"daily" | "weekly" | "monthly", number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export const getActivityReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ period: z.enum(["daily", "weekly", "monthly"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ metric: string; count: number }[]> => {
    await assertAdmin(context.supabase, context.userId);
    const since = new Date(
      Date.now() - PERIOD_DAYS[data.period] * 24 * 60 * 60 * 1000,
    ).toISOString();
    const db: LooseClient = context.supabase;

    const [
      { count: newUsers },
      { count: assessmentsCompleted },
      { count: certificatesIssued },
      { count: skillsVerified },
      { count: ticketsOpened },
    ] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
      context.supabase
        .from("assessment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("status", "evaluated")
        .gte("submitted_at", since),
      context.supabase
        .from("certificates")
        .select("id", { count: "exact", head: true })
        .gte("issued_at", since),
      db.from("badges").select("id", { count: "exact", head: true }).gte("issued_at", since),
      db
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since),
    ]);

    return [
      { metric: "New candidates", count: newUsers ?? 0 },
      { metric: "Assessments completed", count: assessmentsCompleted ?? 0 },
      { metric: "Certificates issued", count: certificatesIssued ?? 0 },
      { metric: "Badges/skills verified", count: skillsVerified ?? 0 },
      { metric: "Support tickets opened", count: ticketsOpened ?? 0 },
    ];
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAuditLogEntry[]> => {
    await assertAdmin(context.supabase, context.userId);
    const db: LooseClient = context.supabase;
    const { data: rows, error } = await db
      .from("admin_audit_log")
      .select("id, actor_id, action, target_type, target_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const actorIds: string[] = Array.from(
      new Set((rows ?? []).map((r: { actor_id: string }) => r.actor_id)),
    );
    const { data: profiles } = actorIds.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (rows ?? []).map((r: LooseClient) => ({
      id: r.id,
      actorId: r.actor_id,
      actorName: nameById.get(r.actor_id) ?? "Admin",
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      createdAt: r.created_at,
    }));
  });

export const listAttemptsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid().optional(),
        level: levelEnum.optional(),
        status: z.string().optional(),
        userId: z.string().uuid().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminAttemptRecord[]> => {
    await assertAdmin(context.supabase, context.userId);
    // No direct FK from assessment_attempts to profiles (both reference auth.users
    // independently), so Postgrest can't embed profiles here — fetch and merge separately.
    // `flagged`/`flag_reason` aren't in the generated Database type yet (hand-written
    // migration) — cast to LooseClient for this query, same as admin_audit_log/badges.
    const db: LooseClient = context.supabase;
    let query = db
      .from("assessment_attempts")
      .select(
        "id, user_id, skill_id, level, status, score, correct_count, passed, started_at, submitted_at, deadline_at, question_ids, flagged, flag_reason, skills(name)",
      )
      .order("started_at", { ascending: false })
      .limit(300);
    if (data.skillId) query = query.eq("skill_id", data.skillId);
    if (data.level) query = query.eq("level", data.level);
    if (data.status) query = query.eq("status", data.status);
    if (data.userId) query = query.eq("user_id", data.userId);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const userIds: string[] = Array.from(
      new Set((rows ?? []).map((a: { user_id: string }) => a.user_id)),
    );
    const { data: profiles } = userIds.length
      ? await context.supabase.from("profiles").select("id, full_name").in("id", userIds)
      : { data: [] as { id: string; full_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

    return (rows ?? []).map((a: LooseClient) => ({
      id: a.id,
      userId: a.user_id,
      userName: nameById.get(a.user_id) ?? "Candidate",
      skillId: a.skill_id,
      skillName: (a.skills as { name: string } | null)?.name ?? "Skill",
      level: levelFromString(a.level),
      status: a.status,
      score: a.score,
      correctCount: a.correct_count,
      totalQuestions: (a.question_ids ?? []).length,
      passed: a.passed,
      startedAt: a.started_at,
      submittedAt: a.submitted_at,
      deadlineAt: a.deadline_at,
      flagged: Boolean(a.flagged),
      flagReason: (a.flag_reason as string) ?? null,
    }));
  });

export const resetAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const { error, data: updated } = await context.supabase
      .from("assessment_attempts")
      .update({ status: "abandoned" })
      .eq("id", data.attemptId)
      .eq("status", "in_progress")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("Only stuck in-progress attempts can be reset.");
    await logAudit(
      context.supabase,
      context.userId,
      "attempt.reset",
      "assessment_attempt",
      data.attemptId,
      {},
    );
    return { ok: true };
  });

export const flagAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        flagged: z.boolean(),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const db: LooseClient = context.supabase;
    const { error } = await db
      .from("assessment_attempts")
      .update({
        flagged: data.flagged,
        flag_reason: data.flagged ? (data.reason?.trim() ?? null) : null,
      })
      .eq("id", data.attemptId);
    if (error) throw new Error(error.message);
    await logAudit(
      context.supabase,
      context.userId,
      data.flagged ? "attempt.flag" : "attempt.unflag",
      "assessment_attempt",
      data.attemptId,
      { reason: data.reason ?? null },
    );
    return { ok: true };
  });
