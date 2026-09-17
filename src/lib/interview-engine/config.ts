import type { InterviewEngineConfig, ScoringWeights } from "./types";

/**
 * Default weighted-evaluation model: Technical Knowledge 35%, Practical
 * Skills 25%, Problem Solving 15%, Communication 10%, Confidence 10%,
 * Safety & Best Practices 5%.
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  technicalKnowledge: 0.35,
  practicalSkill: 0.25,
  problemSolving: 0.15,
  communication: 0.1,
  confidence: 0.1,
  safetyBestPractices: 0.05,
};

function readEnv(name: string): string | undefined {
  return process.env[name];
}

function readLanguages(): string[] {
  const raw = readEnv("BUSTLER_LANGUAGES");
  if (!raw) return ["English", "Malayalam"];
  const list = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ["English", "Malayalam"];
}

/**
 * Built lazily (not a top-level constant) so `process.env` is only ever read
 * inside a function call. `interview.functions.ts` (client-bundled) imports
 * `interview.server.ts` statically, which pulls this module in — a top-level
 * `process.env` read would crash the browser with `process is not defined`,
 * since only the server actually calls `createEngineConfig()`.
 */
function defaultEngineConfig(): InterviewEngineConfig {
  return {
    apiKey: readEnv("BUSTLER_GROQ_API_KEY"),
    baseUrl: readEnv("BUSTLER_LLM_BASE_URL") ?? "https://api.groq.com/openai/v1",
    // The plugin originally defaulted to Llama 3.3/3.1 — Groq has since
    // retired those model IDs (confirmed via /v1/models against this
    // account). openai/gpt-oss-120b and -20b are the current available
    // large/small pair for this key.
    model: readEnv("BUSTLER_LLM_MODEL") ?? "openai/gpt-oss-120b",
    evalModel: readEnv("BUSTLER_LLM_EVAL_MODEL") ?? "openai/gpt-oss-20b",
    languages: readLanguages(),
    maxQuestions: 15,
    beginnerQuestionCount: 5,
    experiencedQuestionCount: 15,
    maxAttemptsPerSkillPerDay: 3,
    requestTimeoutMs: 45_000,
    maxRetries: 3,
    weights: DEFAULT_WEIGHTS,
  };
}

/**
 * Merge overrides over the defaults. Weights are deep-merged and
 * re-normalised so they always sum to 1.
 */
export function createEngineConfig(
  overrides: Partial<InterviewEngineConfig> = {},
): InterviewEngineConfig {
  const defaults = defaultEngineConfig();
  const weights = normaliseWeights({
    ...defaults.weights,
    ...(overrides.weights ?? {}),
  });
  return { ...defaults, ...overrides, weights };
}

export function normaliseWeights(w: ScoringWeights): ScoringWeights {
  const sum =
    w.technicalKnowledge +
    w.practicalSkill +
    w.problemSolving +
    w.communication +
    w.confidence +
    w.safetyBestPractices;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  return {
    technicalKnowledge: w.technicalKnowledge / sum,
    practicalSkill: w.practicalSkill / sum,
    problemSolving: w.problemSolving / sum,
    communication: w.communication / sum,
    confidence: w.confidence / sum,
    safetyBestPractices: w.safetyBestPractices / sum,
  };
}
