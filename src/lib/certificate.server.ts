import { certificateCode } from "./assessment.server";
import {
  ACCEPTED_CERTIFICATE_TYPES,
  MAX_CERTIFICATE_FILE_BYTES,
  type CertificateSource,
  type CertificateStatus,
  type CertificateSummary,
  type PendingCertificateReview,
} from "./certificate-shared";
import { notifyAdmins } from "./notifications.server";
import { issueBadge } from "./badges.server";

// Loosely typed: the generated Supabase `Database` type lags behind columns
// added by hand-written migrations (source/status/file_path on certificates).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

// `certificates.skills` is a text[] column of skill-name strings (not a join —
// the table also has a `skill_id` FK, but aliasing a join as `skills` would
// collide with this column name in the Postgrest response).
function toSummary(row: Record<string, unknown>): CertificateSummary {
  const skillNames = Array.isArray(row.skills) ? (row.skills as string[]) : [];
  return {
    id: String(row.id),
    code: String(row.code),
    skillId: (row.skill_id as string) ?? null,
    skillName: skillNames[0] ?? "Skill",
    title: String(row.title),
    holderName: String(row.holder_name),
    score: Number(row.score ?? 0),
    level: String(row.level ?? "Foundational"),
    skills: skillNames,
    verifier: String(row.verifier ?? ""),
    assessmentType: String(row.assessment_type ?? ""),
    source: (row.source as CertificateSource) ?? "ai",
    status: (row.status as CertificateStatus) ?? "approved",
    isPublic: Boolean(row.is_public),
    issuedAt: String(row.issued_at),
    expiresAt: String(row.expires_at),
    reviewNotes: (row.review_notes as string) ?? null,
    reviewedAt: (row.reviewed_at as string) ?? null,
  };
}

/** List the caller's own certificates (AI-issued and uploaded, any status). Uses the RLS-scoped client. */
export async function listMyCertificateRows(db: Db, userId: string): Promise<CertificateSummary[]> {
  const { data, error } = await db
    .from("certificates")
    .select(
      "id, code, skill_id, title, holder_name, score, level, skills, verifier, assessment_type, source, status, is_public, issued_at, expires_at, review_notes, reviewed_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => toSummary(row));
}

/** Admin: list every certificate (any user, any status/source). Uses the RLS-scoped client (admin read-all policy). */
export async function listAllCertificatesRows(db: Db): Promise<CertificateSummary[]> {
  const { data, error } = await db
    .from("certificates")
    .select(
      "id, code, skill_id, title, holder_name, score, level, skills, verifier, assessment_type, source, status, is_public, issued_at, expires_at, review_notes, reviewed_at",
    )
    .order("issued_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: Record<string, unknown>) => toSummary(row));
}

/**
 * The client-side file-type/size check (in the upload dialog) only guards
 * the normal UI path — a caller could invoke `submitCertificateUpload`
 * directly with a path to an object that bypassed it entirely. Re-verify
 * the already-uploaded object's real size/MIME type from storage metadata
 * before trusting it; delete and reject if either check fails.
 */
export async function validateUploadedFile(db: Db, filePath: string): Promise<void> {
  const slash = filePath.lastIndexOf("/");
  const folder = filePath.slice(0, slash);
  const filename = filePath.slice(slash + 1);
  const { data: listing, error } = await db.storage
    .from("certificates")
    .list(folder, { search: filename });
  if (error) throw new Error("Could not verify the uploaded file.");
  const entry = ((listing ?? []) as { name: string; metadata?: Record<string, unknown> }[]).find(
    (f) => f.name === filename,
  );
  if (!entry) throw new Error("Uploaded file not found.");

  const size = entry.metadata?.size as number | undefined;
  const mimetype = entry.metadata?.mimetype as string | undefined;
  const tooLarge = typeof size === "number" && size > MAX_CERTIFICATE_FILE_BYTES;
  const wrongType = typeof mimetype === "string" && !ACCEPTED_CERTIFICATE_TYPES.includes(mimetype);
  if (tooLarge || wrongType) {
    await db.storage.from("certificates").remove([filePath]);
    throw new Error(
      tooLarge ? "File is too large. Max 10MB." : "Only PDF, PNG or JPG files are accepted.",
    );
  }
}

/** Insert a pending certificate row for an already-uploaded file. Uses the RLS-scoped client (self-insert policy). */
export async function insertCertificateUpload(
  db: Db,
  args: { userId: string; skillId: string; title: string; filePath: string },
): Promise<{ id: string; code: string }> {
  const [{ data: skill, error: skillErr }, { data: profile }] = await Promise.all([
    db.from("skills").select("slug, name").eq("id", args.skillId).single(),
    db.from("profiles").select("full_name").eq("id", args.userId).maybeSingle(),
  ]);
  if (skillErr || !skill) throw new Error("Skill not found.");

  const code = certificateCode(skill.slug);
  const { data: created, error } = await db
    .from("certificates")
    .insert({
      code,
      user_id: args.userId,
      skill_id: args.skillId,
      title: args.title.trim(),
      holder_name: profile?.full_name ?? "LUA Candidate",
      score: 0,
      level: "Pending review",
      skills: [skill.name],
      verifier: "Lily Upskilling Academy · Manual review",
      assessment_type: "Uploaded certificate",
      source: "upload",
      status: "pending",
      is_public: false,
      file_path: args.filePath,
    })
    .select("id, code")
    .single();
  if (error) throw new Error(error.message);

  await notifyAdmins({
    type: "certificate.pending",
    title: "New certificate awaiting review",
    body: `${profile?.full_name ?? "A candidate"} uploaded "${args.title.trim()}" for ${skill.name}.`,
    targetType: "certificate",
    targetId: created.id,
  });

  return created;
}

/** Admin: list uploaded certificates awaiting or previously reviewed, with a signed URL to the file. */
export async function listPendingUploadReviews(): Promise<PendingCertificateReview[]> {
  const db: Db = await admin();
  const { data, error } = await db
    .from("certificates")
    .select(
      "id, code, skill_id, title, holder_name, status, file_path, created_at, review_notes, skills",
    )
    .eq("source", "upload")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  return Promise.all(
    rows.map(async (row): Promise<PendingCertificateReview> => {
      let fileUrl: string | null = null;
      if (row.file_path) {
        const { data: signed } = await db.storage
          .from("certificates")
          .createSignedUrl(row.file_path as string, 300);
        fileUrl = signed?.signedUrl ?? null;
      }
      const skillNames = Array.isArray(row.skills) ? (row.skills as string[]) : [];
      return {
        id: String(row.id),
        code: String(row.code),
        skillId: (row.skill_id as string) ?? null,
        skillName: skillNames[0] ?? "Skill",
        holderName: String(row.holder_name),
        title: String(row.title),
        status: row.status as CertificateStatus,
        fileUrl,
        createdAt: String(row.created_at),
        reviewNotes: (row.review_notes as string) ?? null,
      };
    }),
  );
}

/** Admin: approve or reject an uploaded certificate. */
export async function setCertificateReview(args: {
  certificateId: string;
  decision: "approved" | "rejected";
  notes: string | null;
  reviewerId: string;
}): Promise<void> {
  const db: Db = await admin();
  const { data: updated, error } = await db
    .from("certificates")
    .update({
      status: args.decision,
      is_public: args.decision === "approved",
      reviewed_by: args.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: args.notes,
    })
    .eq("id", args.certificateId)
    .eq("source", "upload")
    .select("user_id, skill_id")
    .single();
  if (error) throw new Error(error.message);

  if (args.decision === "approved" && updated?.skill_id) {
    await issueBadge({ userId: updated.user_id, skillId: updated.skill_id, type: "certificate" });

    // A certificate can be the candidate's first touchpoint with this skill
    // (uploaded without ever taking an assessment) — make sure it shows up
    // in "My Skills" by ensuring a user_skills row exists.
    const { data: existing } = await db
      .from("user_skills")
      .select("*")
      .eq("user_id", updated.user_id)
      .eq("skill_id", updated.skill_id)
      .maybeSingle();
    const prevVerifications: string[] = existing?.verifications ?? [];
    const prevProgress = (existing?.progress ?? {}) as Record<string, unknown>;
    await db.from("user_skills").upsert(
      {
        user_id: updated.user_id,
        skill_id: updated.skill_id,
        status: "verified",
        score: existing?.score ?? 0,
        completion: Math.max(existing?.completion ?? 0, 100),
        trust: Math.min(100, (existing?.trust ?? 0) + 20),
        verifications: Array.from(new Set([...prevVerifications, "certificate"])),
        progress: {
          identity: Number(prevProgress.identity ?? 100),
          assessment: Number(prevProgress.assessment ?? 0),
          expert: Number(prevProgress.expert ?? 0),
          certificate: 100,
          employer: (prevProgress.employer as string) ?? "not_started",
        },
        issued_at: existing?.issued_at ?? new Date().toISOString(),
        expires_at: existing?.expires_at ?? null,
      },
      { onConflict: "user_id,skill_id" },
    );
  }
}
