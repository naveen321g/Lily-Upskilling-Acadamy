export type InterviewExperienceLevel = "beginner" | "experienced";

export type InterviewSessionStatus = "in_progress" | "completed" | "error";

export type InterviewPhase = "awaiting_experience" | "asking" | "completed" | "error";

export type InterviewChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  questionId?: string;
  createdAt: string;
};

export type InterviewLevel =
  "Needs Training" | "Beginner" | "Intermediate" | "Professional" | "Expert";

export type InterviewReport = {
  verified: boolean;
  approved: boolean;
  rating: number;
  professionalScore: number;
  level: InterviewLevel;
  knowledge: number;
  practicalSkill: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  safety: number;
  experiencePrediction: string;
  strengths: string[];
  improvements: string[];
  verificationConfidence: number;
  questionsAsked: number;
  skill: string;
  category: string;
};

export type InterviewSessionSummary = {
  id: string;
  skillId: string;
  skillName: string;
  status: InterviewSessionStatus;
  phase: InterviewPhase;
  createdAt: string;
  updatedAt: string;
  professionalScore: number | null;
  approved: boolean | null;
};

export type InterviewSessionDetail = InterviewSessionSummary & {
  experienceLevel: InterviewExperienceLevel | null;
  plannedQuestionCount: number;
  messages: InterviewChatMessage[];
  /** 0..1 across the planned questions. */
  progress: number;
  report: InterviewReport | null;
  /** True when the candidate should type an answer next. */
  awaitingAnswer: boolean;
};

/** Skills eligible to pick from on the interview skill-entry screen. */
export type InterviewSkillOption = {
  id: string;
  name: string;
  category: string;
  iconKey: string;
};

/**
 * The AI Interview is scoped to hands-on service/trade skills rather than
 * the general (mostly tech) skill catalog used by the MCQ assessment system
 * — matches what the conversational engine's scenario-based questions were
 * actually designed to evaluate. Extend this list (and add matching rows to
 * the `skills` table) to offer another skill here.
 */
export const INTERVIEW_SKILL_SLUGS = [
  "plumbing",
  "electrician",
  "makeup-artist",
  "graphic-designing",
  "photography",
  "photo-editing",
  "video-editing",
  "tutoring",
  "videography",
  "app-development",
  "aptitude-training",
  "appliance-repairing",
  "coaching",
  "skin-and-body-care",
  "cleaning",
  "cooking",
  "website-development",
  "ac-servicing",
  "driving",
  "consultation",
  "fitness-training",
  "cake-and-baked-goods-making",
] as const;
