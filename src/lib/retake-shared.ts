import type { AssessmentLevel } from "./assessment-shared";

export type RetakeRequestStatus = "pending" | "approved" | "rejected";

export type MyRetakeRequest = {
  id: string;
  skillId: string;
  level: AssessmentLevel;
  reason: string;
  status: RetakeRequestStatus;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminRetakeRequest = {
  id: string;
  userId: string;
  userName: string;
  skillId: string;
  skillName: string;
  level: AssessmentLevel;
  reason: string;
  status: RetakeRequestStatus;
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
