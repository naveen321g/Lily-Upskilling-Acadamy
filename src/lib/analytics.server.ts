import type { AnalyticsSummary } from "./analytics-shared";
import { isSkillFullyVerified } from "./skills-shared";

// Loosely typed: RLS-scoped Supabase client passed in from a server function's `context.supabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function buildAnalyticsSummary(db: Db): Promise<AnalyticsSummary> {
  const [{ data: profiles }, { data: attempts }, { data: certRows }, { data: userSkills }, { data: activeBadges }] =
    await Promise.all([
      db.from("profiles").select("created_at"),
      db
        .from("assessment_attempts")
        .select("skill_id, status, score, passed, skills(name, category)")
        .limit(5000),
      db.from("certificates").select("status"),
      // `status` (for expiry) is needed alongside `verifications` — see
      // isSkillFullyVerified. `verifications` itself is only used as a
      // fallback; badges (queried below) are the authoritative source.
      db.from("user_skills").select("user_id, skill_id, status, verifications"),
      // Badges — not the `user_skills.verifications` column — are the
      // source of truth for "is this verification still active". Revoking
      // a badge does NOT clear it from `user_skills.verifications`, so
      // reading that column directly would keep counting revoked
      // verifications as active. See isSkillFullyVerified's docstring.
      db.from("badges").select("user_id, skill_id, type").eq("status", "active"),
    ]);

  // --- Users ---
  const totalUsers = (profiles ?? []).length;
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString("en-US", { month: "short" }),
    });
  }
  const growthCounts = new Map(months.map((m) => [m.key, 0]));
  for (const p of (profiles ?? []) as { created_at: string }[]) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (growthCounts.has(key)) growthCounts.set(key, (growthCounts.get(key) ?? 0) + 1);
  }
  const userGrowth = months.map((m) => ({ label: m.label, value: growthCounts.get(m.key) ?? 0 }));

  // --- Assessments ---
  type AttemptRow = {
    skill_id: string;
    status: string;
    score: number | null;
    passed: boolean | null;
    skills: { name: string; category: string } | null;
  };
  const allAttempts = (attempts ?? []) as AttemptRow[];
  const evaluated = allAttempts.filter((a) => a.status === "evaluated");
  const totalAssessments = evaluated.length;
  const passRate = totalAssessments
    ? Math.round((evaluated.filter((a) => a.passed).length / totalAssessments) * 100)
    : 0;

  const bySkill = new Map<string, number>();
  for (const a of allAttempts) {
    const name = a.skills?.name ?? "Unknown";
    bySkill.set(name, (bySkill.get(name) ?? 0) + 1);
  }
  const popularSkills = Array.from(bySkill.entries())
    .map(([skillName, attempts]) => ({ skillName, attempts }))
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 10);

  const byCategory = new Map<string, { total: number; count: number }>();
  for (const a of evaluated) {
    const cat = a.skills?.category ?? "Unknown";
    const entry = byCategory.get(cat) ?? { total: 0, count: 0 };
    entry.total += a.score ?? 0;
    entry.count += 1;
    byCategory.set(cat, entry);
  }
  const categoryScores = Array.from(byCategory.entries())
    .map(([category, v]) => ({
      category,
      avgScore: Math.round(v.total / v.count),
      attempts: v.count,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  // --- Certificates ---
  const certs = (certRows ?? []) as { status?: string }[];
  const certificates = {
    approved: certs.filter((c) => (c.status ?? "approved") === "approved").length,
    pending: certs.filter((c) => c.status === "pending").length,
    rejected: certs.filter((c) => c.status === "rejected").length,
  };

  // --- Badges ---
  // Active-badge-derived verifications per (user, skill) — the authoritative
  // source; see the query comment above for why the raw `user_skills`
  // column can't be trusted here.
  const activeVerificationsByUserSkill = new Map<string, Set<string>>();
  for (const b of (activeBadges ?? []) as { user_id: string; skill_id: string; type: string }[]) {
    const key = `${b.user_id}:${b.skill_id}`;
    const set = activeVerificationsByUserSkill.get(key) ?? new Set<string>();
    set.add(b.type);
    activeVerificationsByUserSkill.set(key, set);
  }

  type UserSkillRow = { user_id: string; skill_id: string; status: string };
  const skillsRows = (userSkills ?? []) as UserSkillRow[];
  const skillsWithActiveVerifications = skillsRows.map((s) => ({
    userId: s.user_id,
    status: s.status,
    verifications: Array.from(
      activeVerificationsByUserSkill.get(`${s.user_id}:${s.skill_id}`) ?? new Set<string>(),
    ),
  }));

  const badges = {
    aiVerified: skillsWithActiveVerifications.filter((s) => s.verifications.includes("ai")).length,
    certificateVerified: skillsWithActiveVerifications.filter((s) =>
      s.verifications.includes("certificate"),
    ).length,
    // Individual skills verified by every required method (Phase 1: AI +
    // Certificate) — the single source of truth is isSkillFullyVerified.
    fullyVerified: skillsWithActiveVerifications.filter((s) => isSkillFullyVerified(s)).length,
  };

  // "Fully Verified Bustler" — a candidate whose EVERY current skill is
  // individually fully verified (all of REQUIRED_VERIFICATIONS active, not
  // just any one of them). Platform-wide count for the admin analytics
  // dashboard (distinct from `badges.fullyVerified`, which counts
  // individual skills, not candidates).
  const skillsByUser = new Map<string, { status: string; verifications: string[] }[]>();
  for (const s of skillsWithActiveVerifications) {
    const list = skillsByUser.get(s.userId) ?? [];
    list.push(s);
    skillsByUser.set(s.userId, list);
  }
  let fullyVerifiedBustlers = 0;
  for (const skills of skillsByUser.values()) {
    if (skills.length > 0 && skills.every((s) => isSkillFullyVerified(s))) {
      fullyVerifiedBustlers += 1;
    }
  }

  return {
    totalUsers,
    userGrowth,
    totalAssessments,
    passRate,
    popularSkills,
    categoryScores,
    certificates,
    badges,
    fullyVerifiedBustlers,
  };
}
