import type { AssessmentLevel, AttemptSummary } from "./assessment-shared";
import type { CertificateSummary } from "./certificate-shared";
import type { MySkillEntry } from "./skills-shared";

export type NextAction = {
  title: string;
  description: string;
  etaMinutes?: number;
  ctaLabel: string;
  ctaTo: string;
  ctaParams?: Record<string, string>;
};

const LEVEL_MINUTES: Record<AssessmentLevel, number> = { beginner: 10, expert: 30 };

/**
 * Picks the single most relevant thing for a candidate to do next, in priority
 * order: unfinished work first, then anything awaiting review, then getting
 * started, then general progress. Pure function over already-fetched data —
 * no new server calls.
 */
export function computeNextAction(args: {
  skills: MySkillEntry[];
  attempts: AttemptSummary[];
  certificates: CertificateSummary[];
}): NextAction {
  const { skills, attempts, certificates } = args;

  const inProgress = attempts
    .filter((a) => a.status === "in_progress")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];
  if (inProgress) {
    return {
      title: `Continue your ${inProgress.skillName} assessment`,
      description: `You're partway through the ${inProgress.level} assessment. Pick up where you left off.`,
      etaMinutes: LEVEL_MINUTES[inProgress.level],
      ctaLabel: "Continue Assessment",
      ctaTo: "/assessments/attempt/$id",
      ctaParams: { id: inProgress.id },
    };
  }

  const rejectedCert = certificates.find((c) => c.status === "rejected");
  if (rejectedCert) {
    return {
      title: `Your ${rejectedCert.skillName} certificate needs attention`,
      description: rejectedCert.reviewNotes
        ? `It was rejected: "${rejectedCert.reviewNotes}"`
        : "It was rejected during review. Re-upload a clearer copy to try again.",
      ctaLabel: "Review & Retry",
      ctaTo: "/certificates",
    };
  }

  const pendingCert = certificates.find((c) => c.status === "pending");
  if (pendingCert) {
    return {
      title: `Your ${pendingCert.skillName} certificate is under review`,
      description: "Our team is reviewing what you submitted. We'll notify you once it's decided.",
      ctaLabel: "Track Verification",
      ctaTo: "/certificates",
    };
  }

  const readyForCertificate = skills.find(
    (s) => s.verifications.includes("ai") && !s.verifications.includes("certificate"),
  );
  if (readyForCertificate) {
    return {
      title: `Add proof for ${readyForCertificate.name}`,
      description:
        "You're AI Skill Verified here — upload a certificate to also earn Certification Verified.",
      ctaLabel: "Upload Certificate",
      ctaTo: "/certificates",
    };
  }

  const failedSkill = skills.find((s) => s.status === "failed");
  if (failedSkill) {
    return {
      title: `Retry your ${failedSkill.name} assessment`,
      description:
        "Your last attempt didn't reach the pass mark. Review the feedback and try again when ready.",
      ctaLabel: "Review & Retry",
      ctaTo: "/assessments",
    };
  }

  if (attempts.length === 0) {
    return {
      title: "Start your verification journey",
      description: "Pick a skill and take a short beginner assessment to see where you stand.",
      etaMinutes: LEVEL_MINUTES.beginner,
      ctaLabel: "Start Assessment",
      ctaTo: "/assessments",
    };
  }

  return {
    title: "Keep building your verified portfolio",
    description: "Explore another skill and add a new AI-verified badge to your profile.",
    ctaLabel: "Explore Skills",
    ctaTo: "/assessments",
  };
}
