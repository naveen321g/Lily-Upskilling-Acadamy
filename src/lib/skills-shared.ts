export type MySkillStatus = "verified" | "pending" | "failed" | "expired";
export type MySkillVerification = "ai" | "expert" | "certificate" | "institution";

/**
 * Phase 1 required verification methods for a skill to count as "Fully
 * Verified". Institution Verified (Phase 2) is deliberately excluded — it
 * isn't issuable yet, and skills must not be required to have it. If a
 * future phase needs a different required set (globally, or per skill),
 * extend this — e.g. make it a function of the skill — rather than
 * hardcoding a new check somewhere else.
 */
export const REQUIRED_VERIFICATIONS: MySkillVerification[] = ["ai", "certificate"];

/**
 * SINGLE SOURCE OF TRUTH for "is this one skill fully verified".
 *
 * A skill is fully verified only when EVERY required verification method
 * (Phase 1: AI Skill Verification AND Certification Verification) is
 * currently active for it — not just any one of them — and the skill
 * itself hasn't expired. Pending / rejected / missing / expired / revoked
 * verifications do not satisfy this.
 *
 * Accepts a loosely-typed subset (not the full `MySkillEntry`) so the same
 * function can be called from both client-shaped data and raw server-side
 * rows without extra casting — do not reimplement this check elsewhere.
 */
export function isSkillFullyVerified(skill: {
  status: string;
  verifications: string[];
}): boolean {
  if (skill.status === "expired") return false;
  return REQUIRED_VERIFICATIONS.every((v) => skill.verifications.includes(v));
}

/**
 * "Fully Verified Bustler" — every skill currently in the candidate's
 * profile is individually fully verified (see `isSkillFullyVerified`).
 * Purely derived from already-fetched data; not a persisted badge row, so
 * it always reflects the current skill portfolio and current badge state.
 *
 * Loosely typed for the same reason as `isSkillFullyVerified` — usable from
 * any shape (client `MySkillEntry[]`, raw server rows, or test fixtures)
 * that has `status`/`verifications` on each entry.
 */
export function isFullyVerifiedBustler(
  skills: { status: string; verifications: string[] }[],
): boolean {
  return skills.length > 0 && skills.every(isSkillFullyVerified);
}

export type SkillRequestStatus = "pending" | "approved" | "rejected";

export type MySkillRequest = {
  id: string;
  name: string;
  category: string | null;
  notes: string | null;
  status: SkillRequestStatus;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type MySkillEntry = {
  id: string;
  slug: string;
  name: string;
  iconKey: string;
  category: string;
  difficulty: string;
  completion: number;
  score: number;
  status: MySkillStatus;
  verifications: MySkillVerification[];
  issuedAt: string | null;
  expiresAt: string | null;
  trust: number;
  certificateCode: string | null;
  progress: {
    identity: number;
    assessment: number;
    expert: number;
    certificate: number;
    employer: "approved" | "pending" | "not_started";
  };
};
