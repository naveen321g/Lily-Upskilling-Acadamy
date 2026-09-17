import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  LEVEL_CONFIG,
  RETAKE_CAP,
  levelFromString,
  type AiFeedback,
  type AttemptAnswers,
  type AttemptDetail,
  type AttemptSummary,
  type SkillCatalogEntry,
} from "./assessment-shared";
import {
  admin,
  asOptions,
  certificateCode,
  certificateLevel,
  drawQuestionIds,
  evaluateWithAi,
  gradeAttempt,
  loadQuestions,
} from "./assessment.server";
import { issueBadge } from "./badges.server";

// `retake_requests` was added by a hand-written migration and isn't in the
// generated Database type yet — same situation as skill_requests/badges.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

export const listSkillCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkillCatalogEntry[]> => {
    const db = await admin();
    const retakesDb: LooseClient = db;
    const [skillsRes, questionsRes, attemptsRes, userSkillsRes, retakesRes] = await Promise.all([
      db
        .from("skills")
        .select("id, slug, name, category, difficulty, icon_key, description")
        .eq("is_active", true)
        .order("name"),
      db.from("questions").select("skill_id, level").eq("status", "published"),
      db
        .from("assessment_attempts")
        .select("skill_id, level, score, status")
        .eq("user_id", context.userId),
      db.from("user_skills").select("skill_id, verifications").eq("user_id", context.userId),
      retakesDb
        .from("retake_requests")
        .select("skill_id, level")
        .eq("user_id", context.userId)
        .eq("status", "approved")
        .is("consumed_at", null),
    ]);
    if (skillsRes.error) throw new Error(skillsRes.error.message);

    const counts = new Map<string, { beginner: number; expert: number }>();
    for (const q of questionsRes.data ?? []) {
      const entry = counts.get(q.skill_id) ?? { beginner: 0, expert: 0 };
      if (q.level === "expert") entry.expert += 1;
      else entry.beginner += 1;
      counts.set(q.skill_id, entry);
    }
    const verified = new Set(
      (userSkillsRes.data ?? [])
        .filter((u) => (u.verifications ?? []).includes("ai"))
        .map((u) => u.skill_id),
    );
    const stats = new Map<
      string,
      { best: number | null; attempts: number; beginnerUsed: number; expertUsed: number }
    >();
    for (const a of attemptsRes.data ?? []) {
      const s = stats.get(a.skill_id) ?? {
        best: null,
        attempts: 0,
        beginnerUsed: 0,
        expertUsed: 0,
      };
      s.attempts += 1;
      if (a.status !== "in_progress") {
        if (a.level === "expert") s.expertUsed += 1;
        else s.beginnerUsed += 1;
      }
      if (a.status === "evaluated" && typeof a.score === "number") {
        s.best = s.best === null ? a.score : Math.max(s.best, a.score);
      }
      stats.set(a.skill_id, s);
    }
    const approvedRetakes = new Set(
      (retakesRes.data ?? []).map(
        (r: { skill_id: string; level: string }) => `${r.skill_id}:${r.level}`,
      ),
    );

    return (skillsRes.data ?? []).map((s) => {
      const c = counts.get(s.id) ?? { beginner: 0, expert: 0 };
      const st = stats.get(s.id) ?? { best: null, attempts: 0, beginnerUsed: 0, expertUsed: 0 };
      return {
        id: s.id,
        slug: s.slug,
        name: s.name,
        category: s.category,
        difficulty: s.difficulty,
        iconKey: s.icon_key,
        description: s.description,
        beginnerQuestions: c.beginner,
        expertQuestions: c.expert,
        aiVerified: verified.has(s.id),
        bestScore: st.best,
        attempts: st.attempts,
        beginnerAttemptsUsed: st.beginnerUsed,
        expertAttemptsUsed: st.expertUsed,
        hasApprovedRetakeBeginner: approvedRetakes.has(`${s.id}:beginner`),
        hasApprovedRetakeExpert: approvedRetakes.has(`${s.id}:expert`),
      };
    });
  });

export const startAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ skillId: z.string().uuid(), level: z.enum(["beginner", "expert"]) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ attemptId: string }> => {
    const db = await admin();
    const { data: existing } = await db
      .from("assessment_attempts")
      .select("id, deadline_at")
      .eq("user_id", context.userId)
      .eq("skill_id", data.skillId)
      .eq("level", data.level)
      .eq("status", "in_progress")
      .gt("deadline_at", new Date().toISOString())
      .maybeSingle();
    if (existing) return { attemptId: existing.id };

    // Attempt cap: 3 completed attempts per skill+level, then an
    // admin-approved retake request is required for one more.
    const { count: usedCount } = await db
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("skill_id", data.skillId)
      .eq("level", data.level)
      .neq("status", "in_progress");

    const retakesDb: LooseClient = db;
    let consumedRetakeId: string | null = null;
    if ((usedCount ?? 0) >= RETAKE_CAP) {
      const { data: approvedRetake } = await retakesDb
        .from("retake_requests")
        .select("id")
        .eq("user_id", context.userId)
        .eq("skill_id", data.skillId)
        .eq("level", data.level)
        .eq("status", "approved")
        .is("consumed_at", null)
        .order("reviewed_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!approvedRetake) {
        throw new Error(
          `You've used all ${RETAKE_CAP} attempts for this assessment. Request a retake and an admin will review it.`,
        );
      }
      consumedRetakeId = approvedRetake.id;
    }

    const ids = await drawQuestionIds(data.skillId, data.level);
    const cfg = LEVEL_CONFIG[data.level];
    const deadline = new Date(Date.now() + cfg.durationMinutes * 60_000).toISOString();
    const { data: created, error } = await db
      .from("assessment_attempts")
      .insert({
        user_id: context.userId,
        skill_id: data.skillId,
        level: data.level,
        question_ids: ids,
        deadline_at: deadline,
        status: "in_progress",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    if (consumedRetakeId) {
      await retakesDb
        .from("retake_requests")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", consumedRetakeId);
    }

    return { attemptId: created.id };
  });

export const getAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ attemptId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AttemptDetail> => {
    const db = await admin();
    const { data: attempt, error } = await db
      .from("assessment_attempts")
      .select("*, skills(name)")
      .eq("id", data.attemptId)
      .eq("user_id", context.userId)
      .single();
    if (error || !attempt) throw new Error("Assessment not found");

    const questions = await loadQuestions(attempt.question_ids ?? []);
    return {
      id: attempt.id,
      skillId: attempt.skill_id,
      skillName: (attempt.skills as { name: string } | null)?.name ?? "Skill",
      level: levelFromString(attempt.level),
      status: attempt.status,
      score: attempt.score,
      correctCount: attempt.correct_count,
      totalQuestions: questions.length,
      passed: attempt.passed,
      startedAt: attempt.started_at,
      submittedAt: attempt.submitted_at,
      deadlineAt: attempt.deadline_at,
      answers: (attempt.answers ?? {}) as AttemptAnswers,
      aiFeedback: (attempt.ai_feedback ?? null) as AiFeedback | null,
      questions: questions.map((q) => ({
        id: q.id,
        kind: q.kind,
        prompt: q.prompt,
        options: asOptions(q.options),
      })),
    };
  });

export const saveAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        answers: z.record(z.string(), z.number().int().min(0).max(9)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ savedAt: string }> => {
    const db = await admin();
    const { error } = await db
      .from("assessment_attempts")
      .update({ answers: data.answers })
      .eq("id", data.attemptId)
      .eq("user_id", context.userId)
      .eq("status", "in_progress");
    if (error) throw new Error(error.message);
    return { savedAt: new Date().toISOString() };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        attemptId: z.string().uuid(),
        answers: z.record(z.string(), z.number().int().min(0).max(9)).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ score: number; passed: boolean }> => {
    const db = await admin();
    const { data: attempt, error } = await db
      .from("assessment_attempts")
      .select("*, skills(id, name, slug)")
      .eq("id", data.attemptId)
      .eq("user_id", context.userId)
      .single();
    if (error || !attempt) throw new Error("Assessment not found");
    if (attempt.status !== "in_progress") {
      return { score: attempt.score ?? 0, passed: Boolean(attempt.passed) };
    }

    const level = levelFromString(attempt.level);
    const cfg = LEVEL_CONFIG[level];
    const answers = { ...((attempt.answers ?? {}) as AttemptAnswers), ...(data.answers ?? {}) };
    const questions = await loadQuestions(attempt.question_ids ?? []);
    const { details, correctCount, score } = gradeAttempt(questions, answers);
    const passed = score >= cfg.passMark;
    const skill = attempt.skills as { id: string; name: string; slug: string } | null;

    const ai = await evaluateWithAi({
      skillName: skill?.name ?? "Skill",
      level,
      score,
      passed,
      details,
    });
    const feedback: AiFeedback = {
      ...ai,
      breakdown: details.map((d) => ({
        questionId: d.questionId,
        prompt: d.prompt,
        correct: d.correct,
        explanation: d.explanation,
      })),
    };

    await db
      .from("assessment_attempts")
      .update({
        answers,
        status: "evaluated",
        submitted_at: new Date().toISOString(),
        score,
        correct_count: correctCount,
        passed,
        ai_feedback: JSON.parse(JSON.stringify(feedback)),
      })
      .eq("id", attempt.id);

    // Update the candidate's skill record.
    const { data: existing } = await db
      .from("user_skills")
      .select("*")
      .eq("user_id", context.userId)
      .eq("skill_id", attempt.skill_id)
      .maybeSingle();

    const prevVerifications: string[] = existing?.verifications ?? [];
    // Only expert-level passes mint a real "ai" badge (see issueBadge call below) —
    // a beginner pass must not be recorded here as if it were one, or readers that
    // trust this column directly (e.g. admin analytics) overcount verified candidates.
    const verifications =
      passed && level === "expert"
        ? Array.from(new Set([...prevVerifications, "ai"]))
        : prevVerifications;
    const prevProgress = (existing?.progress ?? {}) as Record<string, unknown>;
    const progress = {
      identity: Number(prevProgress.identity ?? 100),
      assessment: Math.max(Number(prevProgress.assessment ?? 0), passed ? 100 : score),
      expert: Number(prevProgress.expert ?? 0),
      certificate: Math.max(
        Number(prevProgress.certificate ?? 0),
        passed && level === "expert" ? 100 : 0,
      ),
      employer: (prevProgress.employer as string) ?? "not_started",
    };
    const bestScore = Math.max(existing?.score ?? 0, score);
    const trust = Math.min(100, Math.round(bestScore * 0.6 + verifications.length * 10));

    await db.from("user_skills").upsert(
      {
        user_id: context.userId,
        skill_id: attempt.skill_id,
        status: passed ? (level === "expert" ? "verified" : "pending") : "failed",
        score: bestScore,
        completion: Math.max(
          existing?.completion ?? 0,
          passed ? (level === "expert" ? 100 : 60) : 30,
        ),
        trust,
        verifications,
        progress,
        issued_at:
          passed && level === "expert" ? new Date().toISOString() : (existing?.issued_at ?? null),
        expires_at:
          passed && level === "expert"
            ? new Date(Date.now() + 3 * 365 * 24 * 3600_000).toISOString()
            : (existing?.expires_at ?? null),
      },
      { onConflict: "user_id,skill_id" },
    );

    // Issue a certificate for a passed expert assessment.
    if (passed && level === "expert" && skill) {
      const { data: profile } = await db
        .from("profiles")
        .select("full_name")
        .eq("id", context.userId)
        .maybeSingle();
      await db.from("certificates").insert({
        code: certificateCode(skill.slug),
        user_id: context.userId,
        skill_id: skill.id,
        attempt_id: attempt.id,
        title: skill.name,
        holder_name: profile?.full_name ?? "LUA Candidate",
        score,
        level: certificateLevel(score),
        skills: [skill.name],
        assessment_type: "AI-evaluated expert assessment",
      });
      await issueBadge({ userId: context.userId, skillId: skill.id, type: "ai" });
    }

    return { score, passed };
  });

export const listAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AttemptSummary[]> => {
    const db = await admin();
    const { data, error } = await db
      .from("assessment_attempts")
      .select(
        "id, skill_id, level, status, score, correct_count, passed, started_at, submitted_at, deadline_at, question_ids, skills(name)",
      )
      .eq("user_id", context.userId)
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((a) => ({
      id: a.id,
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
    }));
  });
