/**
 * Deterministic scoring. Keeping the math out of the LLM makes certification
 * results reproducible and auditable — the model judges answers, but the
 * final score is computed here from those judgements.
 */

import type {
  AnswerEvaluation,
  CertificationReport,
  FinalLevel,
  ScoringWeights,
  SkillRequest,
} from "../types";
import { clamp } from "../utils/json";

export interface AggregatedScores {
  /** Each 0–100. */
  knowledge: number;
  practicalSkill: number;
  problemSolving: number;
  communication: number;
  confidence: number;
  safety: number;
  /** Weighted professional score 0–100. */
  professionalScore: number;
  /** Mean AI-generated likelihood across answers (0–1). */
  averageAiLikelihood: number;
  /** Verification confidence 0–100. */
  verificationConfidence: number;
}

/**
 * Aggregate per-answer dimension scores (0–10) into 0–100 dimension means and
 * a weighted overall professional score.
 */
export function aggregateScores(
  evaluations: AnswerEvaluation[],
  weights: ScoringWeights,
): AggregatedScores {
  if (evaluations.length === 0) {
    return {
      knowledge: 0,
      practicalSkill: 0,
      problemSolving: 0,
      communication: 0,
      confidence: 0,
      safety: 0,
      professionalScore: 0,
      averageAiLikelihood: 0,
      verificationConfidence: 0,
    };
  }

  const mean = (pick: (e: AnswerEvaluation) => number) =>
    evaluations.reduce((sum, e) => sum + pick(e), 0) / evaluations.length;

  // Dimension means on a 0–10 scale.
  const tk = mean((e) => e.dimensions.technicalKnowledge);
  const ps = mean((e) => e.dimensions.practicalSkill);
  const pr = mean((e) => e.dimensions.problemSolving);
  const co = mean((e) => e.dimensions.communication);
  const cf = mean((e) => e.dimensions.confidence);
  const sf = mean((e) => e.dimensions.safetyBestPractices);

  const weighted10 =
    tk * weights.technicalKnowledge +
    ps * weights.practicalSkill +
    pr * weights.problemSolving +
    co * weights.communication +
    cf * weights.confidence +
    sf * weights.safetyBestPractices;

  const averageAiLikelihood = mean((e) => e.cheat.aiGeneratedLikelihood);
  const repeatedCount = evaluations.filter((e) => e.cheat.repeated).length;
  const contradictoryCount = evaluations.filter((e) => e.cheat.contradictory).length;

  // Verification confidence drops with integrity red flags. The AI-generated
  // weight is tuned so that pervasively AI-authored answers fall below the
  // default certification threshold (60), while an occasional moderate signal
  // on otherwise-genuine answers does not.
  const integrityPenalty =
    averageAiLikelihood * 50 +
    (repeatedCount / evaluations.length) * 20 +
    (contradictoryCount / evaluations.length) * 25;
  const verificationConfidence = Math.round(clamp(100 - integrityPenalty, 0, 100));

  return {
    knowledge: to100(tk),
    practicalSkill: to100(ps),
    problemSolving: to100(pr),
    communication: to100(co),
    confidence: to100(cf),
    safety: to100(sf),
    professionalScore: to100(weighted10),
    averageAiLikelihood,
    verificationConfidence,
  };
}

function to100(scoreOutOf10: number): number {
  return Math.round(clamp(scoreOutOf10 * 10, 0, 100));
}

export function levelForScore(score: number): FinalLevel {
  if (score < 50) return "Needs Training";
  if (score < 70) return "Beginner";
  if (score < 85) return "Intermediate";
  if (score < 95) return "Professional";
  return "Expert";
}

/** Convert a 0–100 professional score to a 0–5 star rating, one decimal. */
export function ratingForScore(score: number): number {
  return Math.round((score / 20) * 10) / 10;
}

export interface BuildReportInput {
  request: SkillRequest;
  aggregate: AggregatedScores;
  questionsAsked: number;
  strengths: string[];
  improvements: string[];
  experiencePrediction: string;
  /** Minimum verification confidence required to certify. */
  minVerificationConfidence?: number;
  /** Minimum professional score required to certify. */
  minProfessionalScore?: number;
}

export function buildReport(input: BuildReportInput): CertificationReport {
  const { aggregate } = input;
  const level = levelForScore(aggregate.professionalScore);
  const minConf = input.minVerificationConfidence ?? 60;
  const minScore = input.minProfessionalScore ?? 50;

  const approved =
    aggregate.professionalScore >= minScore &&
    aggregate.verificationConfidence >= minConf &&
    level !== "Needs Training";

  return {
    verified: approved,
    approved,
    rating: ratingForScore(aggregate.professionalScore),
    professionalScore: aggregate.professionalScore,
    level,
    knowledge: aggregate.knowledge,
    practicalSkill: aggregate.practicalSkill,
    problemSolving: aggregate.problemSolving,
    communication: aggregate.communication,
    confidence: aggregate.confidence,
    safety: aggregate.safety,
    experiencePrediction: input.experiencePrediction,
    strengths: input.strengths,
    improvements: input.improvements,
    verificationConfidence: aggregate.verificationConfidence,
    questionsAsked: input.questionsAsked,
    skill: input.request.skill,
    category: input.request.category,
  };
}
