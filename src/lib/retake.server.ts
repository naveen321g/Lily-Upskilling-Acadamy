import type { AssessmentLevel } from "./assessment-shared";
import type { AdminRetakeRequest, MyRetakeRequest } from "./retake-shared";

// `retake_requests` was added by a hand-written migration and isn't in the
// generated Database type yet — same situation as skill_requests/badges.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

function toMyRetakeRequest(row: {
  id: string;
  skill_id: string;
  level: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}): MyRetakeRequest {
  return {
    id: row.id,
    skillId: row.skill_id,
    level: row.level as AssessmentLevel,
    reason: row.reason,
    status: row.status as MyRetakeRequest["status"],
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/** Candidate requests one more attempt after using up their cap for a skill+level. Uses the RLS-scoped client. */
export async function createRetakeRequest(
  db: Db,
  userId: string,
  args: { skillId: string; level: AssessmentLevel; reason: string },
): Promise<{ id: string }> {
  const { data: existing } = await db
    .from("retake_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("skill_id", args.skillId)
    .eq("level", args.level)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) throw new Error("You already have a pending retake request for this assessment.");

  const { data, error } = await db
    .from("retake_requests")
    .insert({
      user_id: userId,
      skill_id: args.skillId,
      level: args.level,
      reason: args.reason,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id };
}

/** The caller's own retake requests, newest first. Uses the RLS-scoped client. */
export async function listMyRetakeRequestsRows(db: Db, userId: string): Promise<MyRetakeRequest[]> {
  const { data, error } = await db
    .from("retake_requests")
    .select("id, skill_id, level, reason, status, admin_notes, created_at, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Parameters<typeof toMyRetakeRequest>[0]) => toMyRetakeRequest(r));
}

/** Admin: every retake request, newest first. Uses the RLS-scoped client (admin read-all policy). */
export async function listRetakeRequestsAdmin(db: Db): Promise<AdminRetakeRequest[]> {
  const { data: rows, error } = await db
    .from("retake_requests")
    .select(
      "id, user_id, skill_id, level, reason, status, admin_notes, created_at, reviewed_at, skills(name)",
    )
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);

  const userIds = Array.from(
    new Set((rows ?? []).map((r: { user_id: string }) => r.user_id)),
  ) as string[];
  const { data: profiles } = userIds.length
    ? await db.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const nameById = new Map(
    (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]),
  );

  return (rows ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    userId: String(r.user_id),
    userName: nameById.get(String(r.user_id)) ?? "Candidate",
    skillId: String(r.skill_id),
    skillName: (r.skills as { name?: string } | null)?.name ?? "Skill",
    level: r.level as AssessmentLevel,
    reason: String(r.reason),
    status: r.status as AdminRetakeRequest["status"],
    adminNotes: (r.admin_notes as string) ?? null,
    createdAt: String(r.created_at),
    reviewedAt: (r.reviewed_at as string) ?? null,
  }));
}

/** Admin: approve or reject a retake request. Uses the RLS-scoped client (admin update policy). */
export async function reviewRetakeRequestAdmin(
  db: Db,
  args: {
    requestId: string;
    decision: "approved" | "rejected";
    adminNotes: string | null;
    reviewerId: string;
  },
): Promise<void> {
  const { error } = await db
    .from("retake_requests")
    .update({
      status: args.decision,
      admin_notes: args.adminNotes,
      reviewed_by: args.reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", args.requestId)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
}
