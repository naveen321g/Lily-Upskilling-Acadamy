import type { AssessmentLevel } from "./assessment-shared";
import type { GeneratedQuestion } from "./admin-shared";

/** Verify the caller holds the admin role using their own RLS-scoped client. */
export async function assertAdmin(supabase: unknown, userId: string) {
  const client = supabase as {
    rpc: (
      fn: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => Promise<{ data: unknown; error: unknown }>;
  };
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) throw new Error("Forbidden: admin access required.");
}

/** Record an admin action to admin_audit_log. Best-effort — never blocks the caller. */
export async function logAudit(
  supabase: unknown,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  const client = supabase as {
    from: (table: "admin_audit_log") => {
      insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
    };
  };
  const { error } = await client.from("admin_audit_log").insert({
    actor_id: actorId,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
  if (error) console.error("[audit log] failed to record entry", error);
}

const LEVEL_BRIEF: Record<AssessmentLevel, string> = {
  beginner:
    "foundational recall and basic understanding suitable for someone new to the skill; avoid trick questions",
  expert:
    "applied, scenario-based reasoning for an experienced practitioner; include trade-offs and edge cases",
};

/** Generate multiple-choice questions with Groq. Throws with a readable message on failure. */
export async function generateQuestionsWithAi(args: {
  skillName: string;
  category: string;
  level: AssessmentLevel;
  count: number;
  topics?: string;
  existingPrompts: string[];
}): Promise<GeneratedQuestion[]> {
  const { completeJson, isAiConfigured, LLMClientError } = await import("./ai.server");
  if (!isAiConfigured()) {
    throw new Error("AI generation is not configured. Set BUSTLER_GROQ_API_KEY in .env.");
  }

  const avoid = args.existingPrompts
    .slice(0, 40)
    .map((p) => `- ${p}`)
    .join("\n");

  let parsed: { questions?: unknown };
  try {
    parsed = await completeJson<{ questions?: unknown }>({
      system:
        'You write high-quality multiple-choice assessment questions for a professional skill verification platform. Reply ONLY with JSON of the shape {"questions":[{"prompt":string,"options":[string,string,string,string],"correctIndex":number,"explanation":string}]}. Exactly 4 options per question, exactly one unambiguously correct answer, plausible distractors, no "all of the above", no numbering in prompts, explanation under 40 words.',
      user: [
        `Skill: ${args.skillName} (${args.category})`,
        `Level: ${args.level} — ${LEVEL_BRIEF[args.level]}`,
        `Write exactly ${args.count} questions.`,
        args.topics ? `Focus topics: ${args.topics}` : "",
        avoid ? `Do not duplicate or paraphrase these existing questions:\n${avoid}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      // ~150 tokens per question, plus headroom for the model's reasoning.
      maxTokens: 1024 + args.count * 250,
      temperature: 0.7,
    });
  } catch (error) {
    if (error instanceof LLMClientError) {
      if (error.status === 429) throw new Error("AI rate limit reached. Try again in a moment.");
      if (error.status === 401)
        throw new Error("The Groq API key was rejected. Check BUSTLER_GROQ_API_KEY.");
      throw new Error("The AI generator could not be reached.");
    }
    throw new Error("The AI generator returned malformed output.");
  }

  const rows = Array.isArray(parsed.questions) ? parsed.questions : [];
  const clean: GeneratedQuestion[] = [];
  for (const raw of rows) {
    const q = raw as Partial<GeneratedQuestion>;
    const options = Array.isArray(q.options) ? q.options.map((o) => String(o)).filter(Boolean) : [];
    const idx = Number(q.correctIndex);
    if (typeof q.prompt !== "string" || q.prompt.trim().length < 8) continue;
    if (options.length !== 4) continue;
    if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
    clean.push({
      prompt: q.prompt.trim(),
      options,
      correctIndex: idx,
      explanation: typeof q.explanation === "string" ? q.explanation.trim() : "",
    });
  }
  if (!clean.length) throw new Error("The AI generator produced no usable questions.");
  return clean.slice(0, args.count);
}
