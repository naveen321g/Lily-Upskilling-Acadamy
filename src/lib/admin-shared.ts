import type { AssessmentLevel } from "./assessment-shared";

export type QuestionStatus = "draft" | "published" | "archived";

export type AdminQuestion = {
  id: string;
  skillId: string;
  skillName: string;
  level: AssessmentLevel;
  kind: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  status: QuestionStatus;
  source: string;
  createdAt: string;
};

export type QuestionBankStats = {
  total: number;
  published: number;
  draft: number;
  aiGenerated: number;
};

export type AdminSkillOption = {
  id: string;
  name: string;
  category: string;
  beginnerPublished: number;
  expertPublished: number;
  drafts: number;
};

export type GeneratedQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type AdminAttemptRecord = {
  id: string;
  userId: string;
  userName: string;
  skillId: string;
  skillName: string;
  level: AssessmentLevel;
  status: string;
  score: number | null;
  correctCount: number | null;
  totalQuestions: number;
  passed: boolean | null;
  startedAt: string;
  submittedAt: string | null;
  deadlineAt: string;
  flagged: boolean;
  flagReason: string | null;
};

export type AdminSkillRecord = {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  iconKey: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
};

export type AdminSkillRequest = {
  id: string;
  userId: string;
  userName: string;
  name: string;
  category: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminBadgeAppeal = {
  id: string;
  badgeId: string;
  userId: string;
  userName: string;
  skillName: string;
  badgeType: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  adminNotes: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type AdminAuditLogEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
};

export function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
