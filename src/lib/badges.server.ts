import type { AdminBadgeRecord, BadgeType, MyBadge, MyBadgeAppeal } from "./badges-shared";
import type { AdminBadgeAppeal } from "./admin-shared";

// Loosely typed: badges was added by a hand-written migration and isn't in the
// generated Database type yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Show/hide the matching AI-issued or uploaded certificate alongside a badge's active state. */
async function syncCertificateVisibility(
  db: Db,
  args: { userId: string; skillId: string; type: BadgeType; isPublic: boolean },
) {
  await db
    .from("certificates")
    .update({ is_public: args.isPublic })
    .eq("user_id", args.userId)
    .eq("skill_id", args.skillId)
    .eq("source", args.type === "ai" ? "ai" : "upload")
    .eq("status", "approved");
}

/** Issue (or re-activate) a badge for a passed assessment or approved certificate. Best-effort. */
export async function issueBadge(args: {
  userId: string;
  skillId: string;
  type: BadgeType;
}): Promise<void> {
  try {
    const db: Db = await admin();
    const { error } = await db.from("badges").upsert(
      {
        user_id: args.userId,
        skill_id: args.skillId,
        type: args.type,
        status: "active",
        issued_at: new Date().toISOString(),
        revoked_at: null,
        revoked_by: null,
        revoke_reason: null,
      },
      { onConflict: "user_id,skill_id,type" },
    );
    if (error) throw new Error(error.message);
    await syncCertificateVisibility(db, { ...args, isPublic: true });
  } catch (error) {
    console.error("[badges] failed to issue badge", error);
  }
}

/** The caller's own badges. Uses the RLS-scoped client (self-read policy) — no service role needed. */
export async function listMyBadgesRows(db: Db, userId: string): Promise<MyBadge[]> {
  const { data, error } = await db
    .from("badges")
    .select("id, skill_id, type, status, issued_at, revoked_at, revoke_reason, skills(name)")
    .eq("user_id", userId)
    .order("issued_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((b: Record<string, unknown>) => ({
    id: String(b.id),
    skillId: String(b.skill_id),
    skillName: (b.skills as { name?: string } | null)?.name ?? "Skill",
    type: b.type as BadgeType,
    status: b.status as MyBadge["status"],
    issuedAt: String(b.issued_at),
    revokedAt: (b.revoked_at as string) ?? null,
    revokeReason: (b.revoke_reason as string) ?? null,
  }));
}

export async function listBadgesAdmin(): Promise<AdminBadgeRecord[]> {
  const db: Db = await admin();
  const { data: badges, error } = await db
    .from("badges")
    .select(
      "id, user_id, skill_id, type, status, issued_at, revoked_at, revoke_reason, skills(name)",
    )
    .order("issued_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((badges ?? []).map((b: { user_id: string }) => b.user_id)));
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
  );

  return (badges ?? []).map((b: Record<string, unknown>) => ({
    id: String(b.id),
    userId: String(b.user_id),
    userName: nameById.get(String(b.user_id)) ?? "Candidate",
    skillId: String(b.skill_id),
    skillName: (b.skills as { name?: string } | null)?.name ?? "Skill",
    type: b.type as BadgeType,
    status: b.status as AdminBadgeRecord["status"],
    issuedAt: String(b.issued_at),
    revokedAt: (b.revoked_at as string) ?? null,
    revokeReason: (b.revoke_reason as string) ?? null,
  }));
}

export async function revokeBadgeAdmin(
  badgeId: string,
  reviewerId: string,
  reason: string | null,
): Promise<void> {
  const db: Db = await admin();
  const { data: badge, error: fetchErr } = await db
    .from("badges")
    .select("user_id, skill_id, type")
    .eq("id", badgeId)
    .single();
  if (fetchErr || !badge) throw new Error("Badge not found.");

  const { error } = await db
    .from("badges")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: reviewerId,
      revoke_reason: reason,
    })
    .eq("id", badgeId);
  if (error) throw new Error(error.message);

  await syncCertificateVisibility(db, {
    userId: badge.user_id,
    skillId: badge.skill_id,
    type: badge.type,
    isPublic: false,
  });
}

/** Candidate submits an appeal for one of their own revoked badges. Uses the RLS-scoped client. */
export async function createBadgeAppeal(
  db: Db,
  userId: string,
  badgeId: string,
  reason: string,
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("badge_appeals")
    .insert({ badge_id: badgeId, user_id: userId, reason })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

/** The caller's own appeals, newest first. Uses the RLS-scoped client. */
export async function listMyBadgeAppealsRows(db: Db, userId: string): Promise<MyBadgeAppeal[]> {
  const { data, error } = await db
    .from("badge_appeals")
    .select("id, badge_id, reason, status, admin_notes, created_at, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    badgeId: String(r.badge_id),
    reason: String(r.reason),
    status: r.status as MyBadgeAppeal["status"],
    adminNotes: (r.admin_notes as string) ?? null,
    createdAt: String(r.created_at),
    reviewedAt: (r.reviewed_at as string) ?? null,
  }));
}

/** Admin: every appeal, newest first. Uses the service-role client, matching every other admin badge mutation in this file. */
export async function listBadgeAppealsAdmin(): Promise<AdminBadgeAppeal[]> {
  const db: Db = await admin();
  const { data: appeals, error } = await db
    .from("badge_appeals")
    .select(
      "id, badge_id, user_id, reason, status, admin_notes, created_at, reviewed_at, badges(type, skill_id, skills(name))",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  const userIds = Array.from(new Set((appeals ?? []).map((a: { user_id: string }) => a.user_id)));
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
  );

  return (appeals ?? []).map((a: Record<string, unknown>) => {
    const badge = a.badges as { type?: string; skills?: { name?: string } | null } | null;
    return {
      id: String(a.id),
      badgeId: String(a.badge_id),
      userId: String(a.user_id),
      userName: nameById.get(String(a.user_id)) ?? "Candidate",
      skillName: badge?.skills?.name ?? "Skill",
      badgeType: badge?.type ?? "badge",
      reason: String(a.reason),
      status: a.status as AdminBadgeAppeal["status"],
      adminNotes: (a.admin_notes as string) ?? null,
      createdAt: String(a.created_at),
      reviewedAt: (a.reviewed_at as string) ?? null,
    };
  });
}

/** Admin: approve (reinstates the badge) or reject an appeal. */
export async function reviewBadgeAppealAdmin(args: {
  appealId: string;
  decision: "approved" | "rejected";
  adminNotes: string | null;
  reviewerId: string;
}): Promise<void> {
  const db: Db = await admin();
  const { data: appeal, error: fetchErr } = await db
    .from("badge_appeals")
    .select("badge_id, status")
    .eq("id", args.appealId)
    .single();
  if (fetchErr || !appeal) throw new Error("Appeal not found.");
  if (appeal.status !== "pending") throw new Error("This appeal has already been reviewed.");

  const { error } = await db
    .from("badge_appeals")
    .update({
      status: args.decision,
      admin_notes: args.adminNotes,
      reviewed_by: args.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", args.appealId);
  if (error) throw new Error(error.message);

  if (args.decision === "approved") {
    await reissueBadgeAdmin(appeal.badge_id);
  }
}

export async function reissueBadgeAdmin(badgeId: string): Promise<void> {
  const db: Db = await admin();
  const { data: badge, error: fetchErr } = await db
    .from("badges")
    .select("user_id, skill_id, type")
    .eq("id", badgeId)
    .single();
  if (fetchErr || !badge) throw new Error("Badge not found.");

  const { error } = await db
    .from("badges")
    .update({ status: "active", revoked_at: null, revoked_by: null, revoke_reason: null })
    .eq("id", badgeId);
  if (error) throw new Error(error.message);

  await syncCertificateVisibility(db, {
    userId: badge.user_id,
    skillId: badge.skill_id,
    type: badge.type,
    isPublic: true,
  });
}
