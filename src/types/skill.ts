import type { LucideIcon } from "lucide-react";

export type VerificationStatus = "verified" | "pending" | "failed" | "expired";
export type VerificationType = "ai" | "expert" | "certificate" | "institution";
export type Difficulty = "Beginner" | "Intermediate" | "Advanced" | "Expert";

export interface Skill {
  id: string;
  name: string;
  icon: LucideIcon;
  category: string;
  difficulty: string;
  completion: number;
  score: number;
  status: VerificationStatus;
  verifications: VerificationType[];
  issued: string | null;
  expires: string | null;
  trust: number;
  /** Code of the best available certificate for this skill (AI-issued or an approved upload), if any. */
  certificateCode: string | null;
  progress: {
    identity: number;
    assessment: number;
    expert: number;
    certificate: number;
    employer: "approved" | "pending" | "not_started";
  };
}
