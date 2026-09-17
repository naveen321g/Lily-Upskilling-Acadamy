// "institution" is a Phase 2 placeholder (see Lily Upskilling Academy.pdf) —
// partner-institution verification isn't issuable yet, but the type is wired
// through now so the UI/DB don't need redesigning when that phase lands.
export type BadgeType = "ai" | "certificate" | "institution";
export type BadgeStatus = "active" | "revoked";

export type AdminBadgeRecord = {
  id: string;
  userId: string;
  userName: string;
  skillId: string;
  skillName: string;
  type: BadgeType;
  status: BadgeStatus;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type MyBadge = {
  id: string;
  skillId: string;
  skillName: string;
  type: BadgeType;
  status: BadgeStatus;
  issuedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type AppealStatus = "pending" | "approved" | "rejected";

export type MyBadgeAppeal = {
  id: string;
  badgeId: string;
  reason: string;
  status: AppealStatus;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
