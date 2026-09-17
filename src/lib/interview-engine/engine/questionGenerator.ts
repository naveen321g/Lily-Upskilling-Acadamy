import type { LLMClient } from "../llm/LLMClient";
import type { Difficulty, InterviewQuestion, LocalizedText, QuestionType } from "../types";
import { uid } from "../utils/id";
import { parseJsonObject } from "../utils/json";
import { GenerateQuestionContext, generateQuestionPrompt } from "./prompts";
import { formatLocalized, primaryLanguage } from "./localize";

interface RawQuestion {
  prompt: string;
  promptTranslations?: Record<string, string>;
  type?: QuestionType;
  difficulty?: Difficulty;
  isFollowUp?: boolean;
  intent?: string;
  scoringRubric?: string;
}

/**
 * Generate a single fresh question. The shown text is `prompt`; `intent` and
 * `scoringRubric` are internal and must never reach the UI.
 */
export async function generateQuestion(
  llm: LLMClient,
  ctx: GenerateQuestionContext,
  signal?: AbortSignal,
): Promise<InterviewQuestion> {
  const { system, user } = generateQuestionPrompt(ctx);
  const raw = await llm.complete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.85, // higher temperature => more variety across interviews
    maxTokens: 900,
    json: true,
    signal,
  });

  const parsed = parseJsonObject<RawQuestion>(raw);
  const primary = primaryLanguage(ctx.languages);
  const promptText = (parsed.prompt ?? "").trim();

  // Assemble the per-language map (primary + any translations the model gave).
  const localizedPrompts: LocalizedText = { [primary]: promptText };
  if (parsed.promptTranslations) {
    for (const [lang, text] of Object.entries(parsed.promptTranslations)) {
      if (typeof text === "string" && text.trim()) localizedPrompts[lang] = text.trim();
    }
  }
  const displayPrompt = formatLocalized(ctx.languages, localizedPrompts, promptText);

  return {
    id: uid("q"),
    index: ctx.questionIndex,
    type: parsed.type ?? ctx.desiredType,
    difficulty: parsed.difficulty ?? ctx.targetDifficulty,
    prompt: promptText,
    displayPrompt,
    localizedPrompts,
    intent: parsed.intent ?? "",
    scoringRubric: parsed.scoringRubric ?? "",
    isFollowUp: Boolean(parsed.isFollowUp),
    followUpToId: parsed.isFollowUp ? ctx.previousQuestions.at(-1)?.id : undefined,
    createdAt: Date.now(),
  };
}
