import type { LLMClient } from "../llm/LLMClient";
import type { AnswerEvaluation, InterviewQuestion } from "../types";
import { clamp, parseJsonObject } from "../utils/json";
import { EvaluateAnswerContext, evaluateAnswerPrompt } from "./prompts";
import { isLocallyGeneric, isLocallyRepeated } from "./security";

interface RawEvaluation {
  dimensions: {
    technicalKnowledge: number;
    practicalSkill: number;
    problemSolving: number;
    communication: number;
    confidence: number;
    safetyBestPractices: number;
  };
  cheat: {
    aiGeneratedLikelihood: number;
    repeated: boolean;
    contradictory: boolean;
    generic: boolean;
  };
  reasoning: string;
  interviewerReply: string;
  wantsFollowUp: boolean;
}

/**
 * Evaluate one answer with semantic reasoning (via the LLM) and fold in cheap
 * local cheat heuristics. Uses the faster eval model when one is configured.
 */
export async function evaluateAnswer(
  llm: LLMClient,
  question: InterviewQuestion,
  ctx: EvaluateAnswerContext,
  evalModel: string | undefined,
  signal?: AbortSignal,
): Promise<AnswerEvaluation> {
  const { system, user } = evaluateAnswerPrompt(ctx);
  const raw = await llm.complete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    model: evalModel,
    temperature: 0.2, // low temperature => stable, reproducible scoring
    maxTokens: 1000,
    json: true,
    signal,
  });

  const parsed = parseJsonObject<RawEvaluation>(raw);
  const d = parsed.dimensions ?? ({} as RawEvaluation["dimensions"]);

  const dimensions = {
    technicalKnowledge: clamp(num(d.technicalKnowledge), 0, 10),
    practicalSkill: clamp(num(d.practicalSkill), 0, 10),
    problemSolving: clamp(num(d.problemSolving), 0, 10),
    communication: clamp(num(d.communication), 0, 10),
    confidence: clamp(num(d.confidence), 0, 10),
    safetyBestPractices: clamp(num(d.safetyBestPractices), 0, 10),
  };

  // Combine model + local cheat signals (logical OR for the booleans).
  const priorAnswerTexts = ctx.priorAnswers.map((p) => p.answer);
  const cheat = {
    aiGeneratedLikelihood: clamp(num(parsed.cheat?.aiGeneratedLikelihood), 0, 1),
    repeated: Boolean(parsed.cheat?.repeated) || isLocallyRepeated(ctx.answer, priorAnswerTexts),
    contradictory: Boolean(parsed.cheat?.contradictory),
    generic: Boolean(parsed.cheat?.generic) || isLocallyGeneric(ctx.answer),
  };

  const overall =
    (dimensions.technicalKnowledge +
      dimensions.practicalSkill +
      dimensions.problemSolving +
      dimensions.communication +
      dimensions.confidence +
      dimensions.safetyBestPractices) /
    6;

  return {
    questionId: question.id,
    overall: Math.round(overall * 10) / 10,
    dimensions,
    cheat,
    reasoning: parsed.reasoning ?? "",
    interviewerReply: (parsed.interviewerReply ?? "").trim() || "Thanks — let's keep going.",
    wantsFollowUp: Boolean(parsed.wantsFollowUp),
    evaluatedAt: Date.now(),
  };
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}
