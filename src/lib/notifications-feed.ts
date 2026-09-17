import type { CertificateSummary } from "./certificate-shared";
import type { MyBadge, MyBadgeAppeal } from "./badges-shared";
import type { MySkillRequest } from "./skills-shared";
import type { MyRetakeRequest } from "./retake-shared";

export type FeedNotification = {
  /** Stable key used for read-tracking in localStorage — never reused across different events. */
  id: string;
  title: string;
  body?: string;
  to: string;
  params?: Record<string, string>;
  createdAt: string;
};

/**
 * Candidates have no persisted notification feed — this derives one from
 * data already fetched elsewhere (certificate decisions, badge revocations,
 * skill-request decisions), each with a real destination. Read/unread state
 * is tracked client-side (see notifications-read.ts), the same localStorage
 * approach already used by the notification-preferences page.
 */
export function buildNotificationFeed(args: {
  certificates: CertificateSummary[];
  badges: MyBadge[];
  skillRequests: MySkillRequest[];
  badgeAppeals?: MyBadgeAppeal[];
  retakeRequests?: MyRetakeRequest[];
}): FeedNotification[] {
  const items: FeedNotification[] = [];

  for (const c of args.certificates) {
    if (c.status === "approved" && c.reviewedAt) {
      items.push({
        id: `cert-approved-${c.id}`,
        title: `${c.title} certificate approved`,
        body: `Your ${c.skillName} certificate is now verified.`,
        to: "/certificates",
        createdAt: c.reviewedAt,
      });
    } else if (c.status === "rejected" && c.reviewedAt) {
      items.push({
        id: `cert-rejected-${c.id}`,
        title: `${c.title} certificate needs attention`,
        body: c.reviewNotes ?? "It was rejected during review — re-upload a clearer copy.",
        to: "/certificates",
        createdAt: c.reviewedAt,
      });
    }
  }

  for (const b of args.badges) {
    if (b.status === "revoked" && b.revokedAt) {
      items.push({
        id: `badge-revoked-${b.id}`,
        title: `${b.skillName} badge revoked`,
        body: b.revokeReason ?? undefined,
        to: "/skills/$id",
        params: { id: b.skillId },
        createdAt: b.revokedAt,
      });
    }
  }

  for (const a of args.badgeAppeals ?? []) {
    if (a.status !== "pending" && a.reviewedAt) {
      items.push({
        id: `badge-appeal-${a.id}`,
        title:
          a.status === "approved"
            ? "Your badge appeal was approved — badge reinstated"
            : "Your badge appeal was not approved",
        body: a.adminNotes ?? undefined,
        to: "/badges",
        createdAt: a.reviewedAt,
      });
    }
  }

  for (const rr of args.retakeRequests ?? []) {
    if (rr.status !== "pending" && rr.reviewedAt) {
      items.push({
        id: `retake-request-${rr.id}`,
        title:
          rr.status === "approved"
            ? `Retake approved for your ${rr.level} assessment`
            : `Retake request wasn't approved`,
        body: rr.adminNotes ?? undefined,
        to: "/assessments",
        createdAt: rr.reviewedAt,
      });
    }
  }

  for (const r of args.skillRequests) {
    if (r.status !== "pending" && r.reviewedAt) {
      items.push({
        id: `skill-request-${r.id}`,
        title:
          r.status === "approved"
            ? `"${r.name}" was added to the catalog`
            : `"${r.name}" request wasn't approved`,
        body: r.adminNotes ?? undefined,
        to: "/skills",
        createdAt: r.reviewedAt,
      });
    }
  }

  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
