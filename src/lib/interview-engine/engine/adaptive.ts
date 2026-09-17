/**
 * Adaptive difficulty + question-type planning.
 *
 * A baseline of easy/intermediate/advanced thirds provides a naturally
 * rising arc, then each question is nudged up or down from the running
 * estimate and the most recent answer.
 */

import type { AnswerEvaluation, Difficulty, QuestionType, SkillEstimate } from "../types";

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "intermediate", "advanced"];

/** Baseline difficulty for a question at `index` of `total`, rising over time. */
export function baselineDifficulty(index: number, total: number): Difficulty {
  const third = total / 3;
  if (index < third) return "easy";
  if (index < third * 2) return "intermediate";
  return "advanced";
}

/**
 * Adapt the baseline using the live estimate and the most recent answer.
 * Strong recent performance can bump difficulty up; struggling pulls it down.
 */
export function adaptDifficulty(
  baseline: Difficulty,
  estimate: SkillEstimate,
  lastEvaluation?: AnswerEvaluation,
): Difficulty {
  let idx = DIFFICULTY_ORDER.indexOf(baseline);

  if (lastEvaluation) {
    if (lastEvaluation.overall >= 8) idx += 1;
    else if (lastEvaluation.overall <= 4) idx -= 1;
  }

  // The slower-moving estimate provides a second signal.
  if (estimate.skillLevel >= 80) idx += 1;
  else if (estimate.skillLevel <= 35) idx -= 1;

  idx = Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, idx));
  return DIFFICULTY_ORDER[idx];
}

/**
 * Choose a question type that keeps the interview varied. Cycles through a
 * curated rotation, skipping any type used too recently and biasing toward
 * practical/scenario styles, which discriminate real ability best.
 */
const ROTATION: QuestionType[] = [
  "scenario",
  "real_customer_problem",
  "troubleshooting",
  "decision_making",
  "debugging",
  "best_practices",
  "practical_workflow",
  "customer_communication",
  "comparison",
  "tool_usage",
  "experience_based",
  "safety",
  "professional_ethics",
  "knowledge",
];

export function chooseQuestionType(usedTypes: QuestionType[], index: number): QuestionType {
  const recent = new Set(usedTypes.slice(-3));
  // Start at a rotating offset so different interviews don't share an order.
  const offset = (index + Math.floor(Math.random() * ROTATION.length)) % ROTATION.length;
  for (let i = 0; i < ROTATION.length; i++) {
    const candidate = ROTATION[(offset + i) % ROTATION.length];
    if (!recent.has(candidate)) return candidate;
  }
  return ROTATION[offset];
}

/**
 * Update the running skill estimate after an evaluation. Uses an exponential
 * moving average so later answers carry appropriate weight without erasing
 * the earlier signal.
 */
export function updateEstimate(prev: SkillEstimate, evaluation: AnswerEvaluation): SkillEstimate {
  const alpha = 0.4;
  const d = evaluation.dimensions;
  const ema = (old: number, sample10: number) =>
    Math.round((1 - alpha) * old + alpha * (sample10 * 10));

  const integrityDrag =
    evaluation.cheat.aiGeneratedLikelihood * 12 +
    (evaluation.cheat.repeated ? 6 : 0) +
    (evaluation.cheat.contradictory ? 8 : 0) +
    (evaluation.cheat.generic ? 5 : 0);

  return {
    skillLevel: clampScore(ema(prev.skillLevel, evaluation.overall) - integrityDrag * 0.3),
    confidence: clampScore(ema(prev.confidence, d.confidence) - integrityDrag * 0.5),
    knowledge: clampScore(ema(prev.knowledge, d.technicalKnowledge)),
    professionalExperience: clampScore(
      ema(prev.professionalExperience, (d.practicalSkill + d.problemSolving) / 2),
    ),
  };
}

export function initialEstimate(): SkillEstimate {
  return { skillLevel: 50, confidence: 50, knowledge: 50, professionalExperience: 50 };
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
