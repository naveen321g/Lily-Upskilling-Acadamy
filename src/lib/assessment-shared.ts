export type AssessmentLevel = "beginner" | "expert";

export type LevelConfig = {
  level: AssessmentLevel;
  label: string;
  questionCount: number;
  durationMinutes: number;
  passMark: number;
  blurb: string;
};

export const LEVEL_CONFIG: Record<AssessmentLevel, LevelConfig> = {
  beginner: {
    level: "beginner",
    label: "Beginner",
    questionCount: 5,
    durationMinutes: 10,
    passMark: 60,
    blurb: "A short foundational check. Five questions, ten minutes, 60% to pass.",
  },
  expert: {
    level: "expert",
    label: "Expert",
    questionCount: 15,
    durationMinutes: 30,
    passMark: 70,
    blurb: "The full verification assessment. Fifteen questions, thirty minutes, 70% to pass.",
  },
};

export type PublicQuestion = {
  id: string;
  kind: string;
  prompt: string;
  options: string[];
};

export type AttemptAnswers = Record<string, number>;

export type AiFeedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  recommendation: string;
  breakdown?: { questionId: string; prompt: string; correct: boolean; explanation: string }[];
};

export type AttemptSummary = {
  id: string;
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
};

export type AttemptDetail = AttemptSummary & {
  answers: AttemptAnswers;
  questions: PublicQuestion[];
  aiFeedback: AiFeedback | null;
};

/** Completed attempts (evaluated or abandoned) allowed per skill+level before an admin-approved retake is required. */
export const RETAKE_CAP = 3;

export type SkillCatalogEntry = {
  id: string;
  slug: string;
  name: string;
  category: string;
  difficulty: string;
  iconKey: string;
  description: string | null;
  beginnerQuestions: number;
  expertQuestions: number;
  aiVerified: boolean;
  bestScore: number | null;
  attempts: number;
  beginnerAttemptsUsed: number;
  expertAttemptsUsed: number;
  hasApprovedRetakeBeginner: boolean;
  hasApprovedRetakeExpert: boolean;
};

export function levelFromString(value: string): AssessmentLevel {
  return value === "expert" ? "expert" : "beginner";
}
