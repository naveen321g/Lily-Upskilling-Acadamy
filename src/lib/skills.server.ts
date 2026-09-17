import type {
  MySkillEntry,
  MySkillRequest,
  MySkillStatus,
  MySkillVerification,
} from "./skills-shared";

// Loosely typed: the generated Supabase `Database` type lags behind columns
// added by hand-written migrations (source/status/file_path on certificates).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RlsClient = any;

type SkillRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  icon_key: string;
};

type UserSkillRow = {
  skill_id: string;
  status: string;
  score: number;
  completion: number;
  trust: number;
  verifications: string[];
  progress: Record<string, unknown>;
  issued_at: string | null;
  expires_at: string | null;
};

type CertificateRow = {
  skill_id: string | null;
  code: string;
  source: string;
  status: string;
  is_public: boolean;
  issued_at: string;
};

type BadgeRow = {
  skill_id: string;
  type: string;
  status: string;
};

/**
 * Compute the candidate's own skill portfolio — only skills they've added,
 * attempted an assessment for, or had a certificate approved for (backed by
 * a user_skills row) — annotated with certificates + badges.
 */
export async function getMySkills(db: RlsClient, userId: string): Promise<MySkillEntry[]> {
  const userSkillsRes = await db.from("user_skills").select("*").eq("user_id", userId);
  if (userSkillsRes.error) throw new Error(String(userSkillsRes.error.message));

  const userSkillRows = (userSkillsRes.data ?? []) as UserSkillRow[];
  if (userSkillRows.length === 0) return [];

  const skillIds = userSkillRows.map((u) => u.skill_id);
  const [skillsRes, certificatesRes, badgesRes] = await Promise.all([
    db.from("skills").select("id, slug, name, category, difficulty, icon_key").in("id", skillIds),
    db
      .from("certificates")
      .select("skill_id, code, source, status, is_public, issued_at")
      .eq("user_id", userId),
    db.from("badges").select("skill_id, type, status").eq("user_id", userId).eq("status", "active"),
  ]);
  if (skillsRes.error)
    throw new Error(
      String((skillsRes.error as { message?: string })?.message ?? "Failed to load skills"),
    );

  const userSkills = new Map<string, UserSkillRow>(userSkillRows.map((u) => [u.skill_id, u]));
  const certsBySkill = new Map<string, CertificateRow[]>();
  for (const c of (certificatesRes.data ?? []) as CertificateRow[]) {
    if (!c.skill_id) continue;
    const list = certsBySkill.get(c.skill_id) ?? [];
    list.push(c);
    certsBySkill.set(c.skill_id, list);
  }
  const activeBadgesBySkill = new Map<string, Set<string>>();
  for (const b of (badgesRes.data ?? []) as BadgeRow[]) {
    const set = activeBadgesBySkill.get(b.skill_id) ?? new Set<string>();
    set.add(b.type);
    activeBadgesBySkill.set(b.skill_id, set);
  }

  const now = Date.now();

  return ((skillsRes.data ?? []) as SkillRow[]).map((s): MySkillEntry => {
    const us = userSkills.get(s.id);
    const certs = (certsBySkill.get(s.id) ?? []).sort(
      (a, b) => new Date(b.issued_at).getTime() - new Date(a.issued_at).getTime(),
    );
    const activeBadgeTypes = activeBadgesBySkill.get(s.id) ?? new Set<string>();

    // Badges are the source of truth for "is this verification still active" —
    // a revoked badge should stop showing here even if the underlying
    // attempt/certificate record still exists.
    const verifications = new Set<MySkillVerification>(
      Array.from(activeBadgeTypes).filter((v): v is MySkillVerification =>
        ["ai", "certificate"].includes(v),
      ),
    );
    const bestCert = certs.find((c) => c.status === "approved" && c.is_public) ?? null;

    let status: MySkillStatus = (us?.status as MySkillStatus) ?? "pending";
    if (us?.expires_at && new Date(us.expires_at).getTime() < now) status = "expired";

    const progress = (us?.progress ?? {}) as Record<string, unknown>;

    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      iconKey: s.icon_key,
      category: s.category,
      difficulty: s.difficulty,
      completion: us?.completion ?? 0,
      score: us?.score ?? 0,
      status,
      verifications: Array.from(verifications),
      issuedAt: us?.issued_at ?? null,
      expiresAt: us?.expires_at ?? null,
      trust: us?.trust ?? 0,
      certificateCode: bestCert?.code ?? null,
      progress: {
        identity: Number(progress.identity ?? 0),
        assessment: Number(progress.assessment ?? 0),
        expert: Number(progress.expert ?? 0),
        certificate: Number(progress.certificate ?? 0),
        employer: (progress.employer as "approved" | "pending" | "not_started") ?? "not_started",
      },
    };
  });
}

/** Add a catalog skill to the candidate's own portfolio (RLS: user manages their own user_skills rows). */
export async function addSkillToProfile(db: RlsClient, userId: string, skillId: string) {
  const { error } = await db
    .from("user_skills")
    .upsert(
      { user_id: userId, skill_id: skillId },
      { onConflict: "user_id,skill_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(String(error.message ?? "Could not add skill."));
}

/** Remove a skill from the candidate's own portfolio. Certificates/badges already earned are untouched. */
export async function removeSkillFromProfile(db: RlsClient, userId: string, skillId: string) {
  const { error } = await db
    .from("user_skills")
    .delete()
    .eq("user_id", userId)
    .eq("skill_id", skillId);
  if (error) throw new Error(String(error.message ?? "Could not remove skill."));
}

function toMySkillRequest(row: {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}): MySkillRequest {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    notes: row.notes,
    status: (row.status as MySkillRequest["status"]) ?? "pending",
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

/** Candidate submits a request for a skill that isn't in the catalog yet. */
export async function createSkillRequest(
  db: RlsClient,
  userId: string,
  input: { name: string; category?: string; notes?: string },
): Promise<{ id: string }> {
  const { data, error } = await db
    .from("skill_requests")
    .insert({
      user_id: userId,
      name: input.name,
      category: input.category ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(String(error.message ?? "Could not submit skill request."));
  return { id: data.id };
}

/** List the candidate's own skill requests, newest first. */
export async function getMySkillRequests(db: RlsClient, userId: string): Promise<MySkillRequest[]> {
  const { data, error } = await db
    .from("skill_requests")
    .select("id, name, category, notes, status, admin_notes, created_at, reviewed_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(String(error.message ?? "Could not load skill requests."));
  return (data ?? []).map((r: Parameters<typeof toMySkillRequest>[0]) => toMySkillRequest(r));
}
