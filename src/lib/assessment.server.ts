import type { AiFeedback, AssessmentLevel, AttemptAnswers } from "./assessment-shared";
import { LEVEL_CONFIG } from "./assessment-shared";

type QuestionRow = {
  id: string;
  prompt: string;
  options: unknown;
  correct_index: number;
  explanation: string | null;
  kind: string;
};

export function asOptions(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

export async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Draw a random set of published question ids for a skill/level. */
export async function drawQuestionIds(skillId: string, level: AssessmentLevel) {
  const db = await admin();
  const { data, error } = await db
    .from("questions")
    .select("id")
    .eq("skill_id", skillId)
    .eq("level", level)
    .eq("status", "published");
  if (error) throw new Error(error.message);
  const pool = (data ?? []).map((q) => q.id);
  const needed = LEVEL_CONFIG[level].questionCount;
  if (pool.length < needed) {
    throw new Error(
      `This skill only has ${pool.length} published ${level} questions. ${needed} are required.`,
    );
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, needed);
}

export async function loadQuestions(ids: string[]): Promise<QuestionRow[]> {
  if (!ids.length) return [];
  const db = await admin();
  const { data, error } = await db
    .from("questions")
    .select("id, prompt, options, correct_index, explanation, kind")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const byId = new Map((data ?? []).map((q) => [q.id, q as QuestionRow]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as QuestionRow[];
}

export function gradeAttempt(questions: QuestionRow[], answers: AttemptAnswers) {
  const details = questions.map((q) => ({
    questionId: q.id,
    prompt: q.prompt,
    chosen: answers[q.id],
    correct: answers[q.id] === q.correct_index,
    explanation: q.explanation ?? "",
    correctAnswer: asOptions(q.options)[q.correct_index] ?? "",
  }));
  const correctCount = details.filter((d) => d.correct).length;
  const total = questions.length || 1;
  return { details, correctCount, score: Math.round((correctCount / total) * 100) };
}

/** Ask Lovable AI for a qualitative evaluation of the attempt. Never throws. */
export async function evaluateWithAi(args: {
  skillName: string;
  level: AssessmentLevel;
  score: number;
  passed: boolean;
  details: { prompt: string; correct: boolean; correctAnswer: string }[];
}): Promise<AiFeedback> {
  const fallback: AiFeedback = {
    summary: args.passed
      ? `You scored ${args.score}% on the ${args.level} ${args.skillName} assessment and met the pass mark.`
      : `You scored ${args.score}% on the ${args.level} ${args.skillName} assessment, below the pass mark.`,
    strengths: args.details.filter((d) => d.correct).slice(0, 3).map((d) => d.prompt),
    gaps: args.details.filter((d) => !d.correct).slice(0, 3).map((d) => d.prompt),
    recommendation: args.passed
      ? "Move on to the next verification layer to strengthen your trust score."
      : "Review the explanations below and retake the assessment when you are ready.",
  };

  const key = process.env.LOVABLE_API_KEY;
  if (!key) return fallback;

  const transcript = args.details
    .map((d, i) => `${i + 1}. ${d.prompt}\n   Result: ${d.correct ? "correct" : "incorrect"} (answer: ${d.correctAnswer})`)
    .join("\n");

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        reasoning_effort: "none",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an assessment evaluator for Lily Upskilling Academy. Given a candidate's assessment results, reply ONLY with JSON matching {\"summary\": string, \"strengths\": string[], \"gaps\": string[], \"recommendation\": string}. Keep the summary under 60 words, at most 4 strengths and 4 gaps, each a short phrase naming a concept (not a restated question). Be direct, professional and specific.",
          },
          {
            role: "user",
            content: `Skill: ${args.skillName}\nLevel: ${args.level}\nScore: ${args.score}% (${args.passed ? "passed" : "failed"})\n\nResults:\n${transcript}`,
          },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return fallback;
    const parsed = JSON.parse(content) as Partial<AiFeedback>;
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 4).map(String) : fallback.strengths,
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 4).map(String) : fallback.gaps,
      recommendation:
        typeof parsed.recommendation === "string" ? parsed.recommendation : fallback.recommendation,
    };
  } catch {
    return fallback;
  }
}

export function certificateCode(skillSlug: string) {
  const token = Math.random().toString(36).slice(2, 6).toUpperCase();
  const year = new Date().getFullYear();
  const prefix = skillSlug.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase() || "LUA";
  return `LUA-${prefix}-${year}-${token}`;
}

export function certificateLevel(score: number) {
  if (score >= 95) return "Expert";
  if (score >= 85) return "Advanced";
  if (score >= 75) return "Proficient";
  return "Foundational";
}
