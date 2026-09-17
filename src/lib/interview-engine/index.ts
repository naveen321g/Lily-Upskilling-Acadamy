/**
 * Portable AI interview engine — question generation, semantic evaluation,
 * adaptive difficulty, deterministic scoring, and integrity heuristics.
 * No Supabase/TanStack imports here; `src/lib/interview.server.ts` is the
 * only caller and owns all persistence.
 */

export * from "./types";
export { createEngineConfig, DEFAULT_WEIGHTS, normaliseWeights } from "./config";

export * from "./llm/LLMClient";
export { GroqClient } from "./llm/GroqClient";

export * from "./engine/scoring";
export * from "./engine/adaptive";
export * from "./engine/security";
export * from "./engine/prompts";
export * from "./engine/localize";
export { generateQuestion } from "./engine/questionGenerator";
export { evaluateAnswer } from "./engine/answerEvaluator";
