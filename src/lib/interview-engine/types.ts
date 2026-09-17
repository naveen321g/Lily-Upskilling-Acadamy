/**
 * Shared type definitions for the AI conversational interview engine.
 *
 * Ported from the framework-agnostic core of `@bustler/ai-skill-certification`
 * (no React/React Native dependency here) so it can run inside a TanStack
 * Start server function, unmodified from how the original engine reasons
 * about an interview.
 */

export type ExperienceLevel = "beginner" | "experienced";

export type Difficulty = "easy" | "intermediate" | "advanced";

/**
 * The categories of question the engine is allowed to generate. The engine
 * deliberately rotates through these so an interview never feels like a quiz.
 */
export type QuestionType =
  | "knowledge"
  | "scenario"
  | "real_customer_problem"
  | "debugging"
  | "decision_making"
  | "safety"
  | "professional_ethics"
  | "tool_usage"
  | "best_practices"
  | "customer_communication"
  | "troubleshooting"
  | "experience_based"
  | "practical_workflow"
  | "comparison"
  | "follow_up";

export type ChatRole = "assistant" | "user" | "system";

/**
 * A piece of text keyed by language display name, e.g.
 * `{ English: "How would you...", Malayalam: "..." }`.
 */
export type LocalizedText = Record<string, string>;

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** Rendered content (markdown allowed for assistant messages). */
  content: string;
  createdAt: number;
  /** Links a user answer / assistant message back to a question. */
  questionId?: string;
  /** Internal flag — never shown to the user (e.g. the welcome message). */
  meta?: boolean;
}

export interface SkillRequest {
  category: string;
  skill: string;
  /** Optional finer-grained specialisation, e.g. "Animations" for RN. */
  subSkill?: string;
}

/**
 * A single question the engine has decided to ask. The `scoringRubric` and
 * `intent` fields are engine-internal and MUST NOT be surfaced to the user.
 */
export interface InterviewQuestion {
  id: string;
  index: number;
  type: QuestionType;
  difficulty: Difficulty;
  /**
   * The question in the primary language (English). Used internally for
   * evaluation context and memory. For what the candidate sees, use
   * `displayPrompt`.
   */
  prompt: string;
  /**
   * The question text actually shown to the candidate — may contain every
   * configured language stacked (e.g. English then Malayalam). Falls back to
   * `prompt` when only one language is configured.
   */
  displayPrompt: string;
  /** The question keyed by language name (includes the primary language). */
  localizedPrompts?: LocalizedText;
  /** Why the engine asked this — internal, used to evaluate the answer. */
  intent: string;
  /** Internal hints on what a strong answer contains. Never shown. */
  scoringRubric: string;
  /** True if this question follows up on a previous answer. */
  isFollowUp: boolean;
  /** The question id this one follows up on, if any. */
  followUpToId?: string;
  createdAt: number;
}

/**
 * The six evaluation dimensions, scored 0–10 per answer by the LLM using
 * semantic reasoning (never keyword matching).
 */
export interface AnswerDimensionScores {
  technicalKnowledge: number;
  practicalSkill: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  safetyBestPractices: number;
}

export interface CheatSignals {
  /** 0–1 likelihood the answer was pasted from an AI / canned source. */
  aiGeneratedLikelihood: number;
  /** True if this answer materially repeats an earlier one. */
  repeated: boolean;
  /** True if this answer contradicts something said earlier. */
  contradictory: boolean;
  /** True if the answer is vague / generic with no concrete substance. */
  generic: boolean;
}

export interface AnswerEvaluation {
  questionId: string;
  /** Composite 0–10 for this single answer (weighted within the answer). */
  overall: number;
  dimensions: AnswerDimensionScores;
  cheat: CheatSignals;
  /** A short, internal note for the engine's own adaptation. Never shown. */
  reasoning: string;
  /**
   * The interviewer's natural-language reply to show the candidate — an
   * encouragement, an appreciation, or a gentle challenge. This is shown.
   */
  interviewerReply: string;
  /** Whether the engine wants to ask a follow-up before moving on. */
  wantsFollowUp: boolean;
  evaluatedAt: number;
}

/**
 * The engine's running, continuously-updated estimate of the candidate.
 * Drives adaptive difficulty.
 */
export interface SkillEstimate {
  skillLevel: number; // 0–100
  confidence: number; // 0–100
  knowledge: number; // 0–100
  professionalExperience: number; // 0–100 (maps loosely to years)
}

export type FinalLevel = "Needs Training" | "Beginner" | "Intermediate" | "Professional" | "Expert";

export interface CertificationReport {
  verified: boolean;
  approved: boolean;
  rating: number; // 0–5, one decimal
  professionalScore: number; // 0–100
  level: FinalLevel;
  knowledge: number;
  practicalSkill: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  safety: number;
  experiencePrediction: string; // e.g. "4-6 Years"
  strengths: string[];
  improvements: string[];
  verificationConfidence: number; // 0–100
  questionsAsked: number;
  skill: string;
  category: string;
}

export type InterviewPhase =
  | "idle"
  | "collecting_skill"
  | "awaiting_experience"
  | "asking"
  | "evaluating"
  | "generating"
  | "completed"
  | "error";

export interface InterviewState {
  sessionId: string;
  phase: InterviewPhase;
  request: SkillRequest | null;
  experienceLevel: ExperienceLevel | null;
  /** Total number of questions this interview will ask (5 or 15). */
  plannedQuestionCount: number;
  questions: InterviewQuestion[];
  evaluations: AnswerEvaluation[];
  messages: ChatMessage[];
  estimate: SkillEstimate;
  report: CertificationReport | null;
  error: string | null;
}

/** Weighting applied to each dimension when computing the professional score. */
export interface ScoringWeights {
  technicalKnowledge: number;
  practicalSkill: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  safetyBestPractices: number;
}

export interface InterviewEngineConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  evalModel: string;
  /**
   * Languages the interview runs in, by display name. The first is the primary
   * language used for internal reasoning/evaluation context. When more than one
   * is listed, questions and interviewer replies are shown in every listed
   * language, and candidates may answer in any of them. Default:
   * `['English', 'Malayalam']`.
   */
  languages: string[];
  /** Hard caps used by the secure session layer. */
  maxQuestions: number;
  beginnerQuestionCount: number;
  experiencedQuestionCount: number;
  /** Per-session attempt limit for replay/abuse protection. */
  maxAttemptsPerSkillPerDay: number;
  /** Network timeout in ms. */
  requestTimeoutMs: number;
  /** Retries for transient network/LLM errors. */
  maxRetries: number;
  weights: ScoringWeights;
}
