import type { FraudSignals } from "./fraud-shared";

// Loosely typed: RLS-scoped Supabase client passed in from a server function's `context.supabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function namesByUserId(db: Db, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();
  const { data } = await db.from("profiles").select("id, full_name").in("id", userIds);
  return new Map(
    ((data ?? []) as { id: string; full_name: string | null }[]).map((p) => [
      p.id,
      p.full_name ?? "Candidate",
    ]),
  );
}

/**
 * Real signals computable from data we actually collect today — not a fraud
 * model. There's no document-forensics, device-fingerprinting or duplicate-account
 * detection here; those would need capabilities this platform doesn't have yet.
 */
export async function buildFraudSignals(db: Db): Promise<FraudSignals> {
  const [{ data: certs }, { data: attempts }, { data: flagged }] = await Promise.all([
    db.from("certificates").select("user_id, skill_id, skills(name)").eq("source", "upload"),
    db.from("assessment_attempts").select("user_id, skill_id, status, passed, skills(name)"),
    db
      .from("assessment_attempts")
      .select("id, user_id, flag_reason, updated_at, skills(name)")
      .eq("flagged", true)
      .order("updated_at", { ascending: false }),
  ]);

  type Group = { count: number; skillName: string };
  const certGroups = new Map<string, Group>();
  for (const c of (certs ?? []) as {
    user_id: string;
    skill_id: string | null;
    skills: { name?: string } | null;
  }[]) {
    if (!c.skill_id) continue;
    const key = `${c.user_id}:${c.skill_id}`;
    const entry = certGroups.get(key) ?? { count: 0, skillName: c.skills?.name ?? "Skill" };
    entry.count += 1;
    certGroups.set(key, entry);
  }
  const duplicateCertPairs = Array.from(certGroups.entries())
    .filter(([, v]) => v.count > 1)
    .map(([key, v]) => {
      const [userId, skillId] = key.split(":");
      return { userId, skillId, skillName: v.skillName, count: v.count };
    });

  const failGroups = new Map<string, Group>();
  for (const a of (attempts ?? []) as {
    user_id: string;
    skill_id: string;
    status: string;
    passed: boolean | null;
    skills: { name?: string } | null;
  }[]) {
    if (a.status !== "evaluated" || a.passed !== false) continue;
    const key = `${a.user_id}:${a.skill_id}`;
    const entry = failGroups.get(key) ?? { count: 0, skillName: a.skills?.name ?? "Skill" };
    entry.count += 1;
    failGroups.set(key, entry);
  }
  const repeatedFailurePairs = Array.from(failGroups.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([key, v]) => {
      const [userId, skillId] = key.split(":");
      return { userId, skillId, skillName: v.skillName, failedCount: v.count };
    });

  const flaggedRows = (flagged ?? []) as {
    id: string;
    user_id: string;
    flag_reason: string | null;
    updated_at: string;
    skills: { name?: string } | null;
  }[];

  const userIds = Array.from(
    new Set([
      ...duplicateCertPairs.map((p) => p.userId),
      ...repeatedFailurePairs.map((p) => p.userId),
      ...flaggedRows.map((r) => r.user_id),
    ]),
  );
  const names = await namesByUserId(db, userIds);

  return {
    duplicateCertificates: duplicateCertPairs
      .map((p) => ({ ...p, userName: names.get(p.userId) ?? "Candidate" }))
      .sort((a, b) => b.count - a.count),
    repeatedFailures: repeatedFailurePairs
      .map((p) => ({ ...p, userName: names.get(p.userId) ?? "Candidate" }))
      .sort((a, b) => b.failedCount - a.failedCount),
    flaggedAttempts: flaggedRows.map((r) => ({
      attemptId: r.id,
      userId: r.user_id,
      userName: names.get(r.user_id) ?? "Candidate",
      skillName: r.skills?.name ?? "Skill",
      reason: r.flag_reason,
      flaggedAt: r.updated_at,
    })),
  };
}
