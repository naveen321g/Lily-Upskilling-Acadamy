import type { CertificateSummary } from "./certificate-shared";
import { isSkillFullyVerified, type MySkillEntry } from "./skills-shared";
import type { ConceptualState } from "./status";

export type VerificationRow = {
  skill: MySkillEntry;
  state: ConceptualState;
  message: string;
  detail?: string;
  fullyVerified: boolean;
};

/** Per-skill verification status: what's blocking full verification, and why. */
export function verificationRowFor(
  skill: MySkillEntry,
  certs: CertificateSummary[],
): VerificationRow {
  const latestCert = certs
    .filter((c) => c.skillId === skill.id)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())[0];

  const hasAi = skill.verifications.includes("ai");

  if (isSkillFullyVerified(skill)) {
    return { skill, state: "verified", message: "Fully verified", fullyVerified: true };
  }
  if (skill.status === "failed") {
    return {
      skill,
      state: "action_required",
      message: "AI assessment didn't reach the pass mark",
      fullyVerified: false,
    };
  }
  if (skill.status === "expired") {
    return {
      skill,
      state: "action_required",
      message: "Verification has expired",
      fullyVerified: false,
    };
  }
  if (!hasAi) {
    return {
      skill,
      state: "action_required",
      message: "AI Verification Required",
      fullyVerified: false,
    };
  }
  // AI-verified, certificate not yet verified — check on a submitted upload.
  if (latestCert?.status === "pending") {
    return {
      skill,
      state: "under_review",
      message: "Certificate Under Review",
      fullyVerified: false,
    };
  }
  if (latestCert?.status === "rejected") {
    return {
      skill,
      state: "rejected",
      message: "Certificate Rejected",
      detail: latestCert.reviewNotes ?? undefined,
      fullyVerified: false,
    };
  }
  return {
    skill,
    state: "action_required",
    message: "Certificate Verification Required",
    fullyVerified: false,
  };
}
