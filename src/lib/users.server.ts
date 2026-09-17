import type {
  AdminUserAttempt,
  AdminUserBadge,
  AdminUserCertificate,
  AdminUserDetail,
  AdminUserSkill,
  AdminUserSummary,
} from "./users-shared";
import { isSkillFullyVerified } from "./skills-shared";

// `badges` was added by a hand-written migration and isn't in the generated
// Database type yet — same situation as admin_audit_log/support_tickets.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type AuthUser = { id: string; email?: string; created_at: string; banned_until?: string | null };

async function listAuthUsers(): Promise<AuthUser[]> {
  const db = await admin();
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(error.message);
  return data.users as unknown as AuthUser[];
}

/** List all candidates with roles + activity counts. Requires the service-role client (auth.users is not exposed via Postgrest). */
export async function listUsersAdmin(search?: string): Promise<AdminUserSummary[]> {
  const db = await admin();
  const authUsers = await listAuthUsers();

  const ids = authUsers.map((u) => u.id);
  const [
    { data: profiles },
    { data: roles },
    { data: userSkills },
    { data: attempts },
    { data: certificates },
  ] = await Promise.all([
    db.from("profiles").select("id, full_name").in("id", ids),
    db.from("user_roles").select("user_id, role").in("user_id", ids),
    db.from("user_skills").select("user_id, verifications").in("user_id", ids),
    db.from("assessment_attempts").select("user_id").in("user_id", ids),
    db.from("certificates").select("user_id").in("user_id", ids),
  ]);

  const profileById = new Map<string, string | null>(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
  );
  const rolesByUser = new Map<string, string[]>();
  for (const r of (roles ?? []) as { user_id: string; role: string }[]) {
    const list = rolesByUser.get(r.user_id) ?? [];
    list.push(r.role);
    rolesByUser.set(r.user_id, list);
  }
  const verifiedByUser = new Map<string, number>();
  for (const us of (userSkills ?? []) as { user_id: string; verifications: string[] }[]) {
    if ((us.verifications ?? []).length > 0) {
      verifiedByUser.set(us.user_id, (verifiedByUser.get(us.user_id) ?? 0) + 1);
    }
  }
  const attemptsByUser = new Map<string, number>();
  for (const a of (attempts ?? []) as { user_id: string }[])
    attemptsByUser.set(a.user_id, (attemptsByUser.get(a.user_id) ?? 0) + 1);
  const certsByUser = new Map<string, number>();
  for (const c of (certificates ?? []) as { user_id: string }[])
    certsByUser.set(c.user_id, (certsByUser.get(c.user_id) ?? 0) + 1);

  let list: AdminUserSummary[] = authUsers.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    fullName: profileById.get(u.id) ?? null,
    roles: rolesByUser.get(u.id) ?? [],
    createdAt: u.created_at,
    bannedUntil: u.banned_until && u.banned_until !== "none" ? u.banned_until : null,
    skillsVerified: verifiedByUser.get(u.id) ?? 0,
    attemptsCount: attemptsByUser.get(u.id) ?? 0,
    certificatesCount: certsByUser.get(u.id) ?? 0,
  }));

  const q = search?.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (u) => u.email.toLowerCase().includes(q) || (u.fullName ?? "").toLowerCase().includes(q),
    );
  }
  return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getUserDetailAdmin(userId: string): Promise<AdminUserDetail | null> {
  const db = await admin();
  const { data: authUser, error } = await db.auth.admin.getUserById(userId);
  if (error || !authUser?.user) return null;

  const [
    { data: profile },
    { data: roles },
    { data: userSkills },
    { data: attempts },
    { data: certificates },
    { data: badges },
  ] = await Promise.all([
    db.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    db.from("user_roles").select("role").eq("user_id", userId),
    db
      .from("user_skills")
      .select("skill_id, status, score, trust, verifications, skills(name)")
      .eq("user_id", userId),
    db
      .from("assessment_attempts")
      .select("id, level, status, score, passed, started_at, skills(name)")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(50),
    db
      .from("certificates")
      .select("id, code, title, status, source, issued_at")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false }),
    db
      .from("badges")
      .select("id, skill_id, type, status, issued_at, skills(name)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  // Active badges — not the `user_skills.verifications` column — are the
  // source of truth for "is this verification still active". Revoking a
  // badge doesn't clear it from that column, so reading it directly here
  // would keep showing a revoked verification as active in the admin view.
  // See isSkillFullyVerified's docstring in skills-shared.ts.
  const activeVerificationsBySkill = new Map<string, Set<string>>();
  for (const b of (badges ?? []) as { skill_id: string; type: string }[]) {
    const set = activeVerificationsBySkill.get(b.skill_id) ?? new Set<string>();
    set.add(b.type);
    activeVerificationsBySkill.set(b.skill_id, set);
  }

  const skills: AdminUserSkill[] = ((userSkills ?? []) as unknown as Record<string, unknown>[]).map(
    (s) => {
      const skillId = String(s.skill_id);
      return {
        skillId,
        skillName: (s.skills as { name?: string } | null)?.name ?? "Skill",
        status: String(s.status),
        score: Number(s.score),
        trust: Number(s.trust),
        verifications: Array.from(activeVerificationsBySkill.get(skillId) ?? new Set<string>()),
      };
    },
  );
  const attemptList: AdminUserAttempt[] = (
    (attempts ?? []) as unknown as Record<string, unknown>[]
  ).map((a) => ({
    id: String(a.id),
    skillName: (a.skills as { name?: string } | null)?.name ?? "Skill",
    level: String(a.level),
    status: String(a.status),
    score: a.score as number | null,
    passed: a.passed as boolean | null,
    startedAt: String(a.started_at),
  }));
  const certificateList: AdminUserCertificate[] = (
    (certificates ?? []) as unknown as Record<string, unknown>[]
  ).map((c) => ({
    id: String(c.id),
    code: String(c.code),
    title: String(c.title),
    status: String(c.status ?? "approved"),
    source: String(c.source ?? "ai"),
    issuedAt: String(c.issued_at),
  }));
  const badgeList: AdminUserBadge[] = ((badges ?? []) as unknown as Record<string, unknown>[]).map(
    (b) => ({
      id: String(b.id),
      skillId: String(b.skill_id),
      skillName: (b.skills as { name?: string } | null)?.name ?? "Skill",
      type: String(b.type),
      status: String(b.status),
      issuedAt: String(b.issued_at),
    }),
  );

  const bannedUntil = authUser.user.banned_until;
  return {
    id: userId,
    email: authUser.user.email ?? "",
    fullName: profile?.full_name ?? null,
    roles: ((roles ?? []) as { role: string }[]).map((r) => r.role),
    createdAt: authUser.user.created_at,
    bannedUntil: bannedUntil && bannedUntil !== "none" ? bannedUntil : null,
    skillsVerified: skills.filter((s) => s.verifications.length > 0).length,
    attemptsCount: attemptList.length,
    certificatesCount: certificateList.length,
    skills,
    attempts: attemptList,
    certificates: certificateList,
    badges: badgeList,
  };
}

export async function setUserBannedAdmin(userId: string, banned: boolean): Promise<void> {
  const db = await admin();
  const { error } = await db.auth.admin.updateUserById(userId, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) throw new Error(error.message);
}

/**
 * Grant or revoke a role for a user. Uses the service-role client because
 * `user_roles` only grants SELECT to `authenticated` (RLS alone isn't
 * enough — Postgres also checks the table-level GRANT). Callers must gate
 * this with assertAdmin() first.
 */
export async function setUserRoleAdmin(
  userId: string,
  role: "admin" | "reviewer",
  grant: boolean,
): Promise<void> {
  const db = await admin();
  if (grant) {
    const { error } = await db
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) throw new Error(error.message);
  }
}
