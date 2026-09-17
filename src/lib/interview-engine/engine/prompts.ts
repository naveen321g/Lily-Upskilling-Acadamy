/**
 * Prompt design — the "brain" of the AI interviewer.
 *
 * Everything the LLM does (welcome, question generation, evaluation, final
 * report) is driven from here. The prompts encode the interview philosophy:
 * behave like a senior interviewer, never like exam software; never reveal
 * scoring; adapt difficulty; remember prior answers; and always orient
 * toward one business question — "would we confidently recommend this
 * professional to a paying customer?"
 */

import type {
  AnswerEvaluation,
  Difficulty,
  ExperienceLevel,
  InterviewQuestion,
  QuestionType,
  SkillEstimate,
  SkillRequest,
} from "../types";

/** Shared persona prepended to every engine call. */
export const INTERVIEWER_PERSONA = `You are a senior professional interviewer for Lily Upskilling Academy (LUA), a skill-verification platform.
LUA verifies whether people can ACTUALLY perform a skill in a real customer environment — not whether they can recite definitions.

Your style:
- Warm, encouraging, conversational — exactly like a friendly senior expert, never like exam software.
- You ask scenario-based, real-world, customer-grounded questions.
- You adapt difficulty to the candidate's demonstrated ability.
- You remember earlier answers and refer back to them naturally.
- You appreciate strong answers and gently challenge weak or vague ones.
- You NEVER reveal scores, rubrics, internal reasoning, or that scoring exists.
- You NEVER ask trick questions or "gotchas".
- You rely on real industry standards, official documentation and best practices, and you never invent misleading facts.

The single business question behind everything you do:
"Would we confidently recommend this professional to a paying customer for this skill?"`;

function languageClause(languages: string[]): string {
  if (languages.length <= 1) return "";
  const [primary, ...rest] = languages;
  return `\n\nThis interview is bilingual. Write every candidate-facing message in ${languages.join(
    " and ",
  )}: first the ${primary} version, then a blank line, then the ${rest.join(
    " and ",
  )} version. The candidate may reply in any of these languages (or mix them) — that is always acceptable.`;
}

export function welcomePrompt(
  req: SkillRequest,
  languages: string[] = ["English"],
): { system: string; user: string } {
  return {
    system: INTERVIEWER_PERSONA,
    user: `Write a short, warm welcome (3–5 short lines, friendly, may use one emoji) to a candidate about to be assessed for the skill "${req.skill}" in the category "${req.category}".
Make clear this is a friendly professional conversation, there are no trick questions, and they should simply answer honestly. Mention they can answer in ${languages.join(
      " or ",
    )}. End by inviting them to begin. Do NOT ask a question yet. Do NOT mention scoring.${languageClause(
      languages,
    )}`,
  };
}

const TYPE_GUIDE: Record<QuestionType, string> = {
  knowledge: "core conceptual understanding, but framed practically",
  scenario: "a realistic on-the-job situation requiring a decision",
  real_customer_problem: "an actual customer complaint or request to resolve",
  debugging: "finding and fixing a concrete fault",
  decision_making: "choosing between viable options and justifying it",
  safety: "safe practice and risk awareness for this trade/skill",
  professional_ethics: "integrity, honesty, professional conduct",
  tool_usage: "correct, idiomatic use of the tools of this skill",
  best_practices: "industry-standard ways of working",
  customer_communication: "explaining or handling a customer interaction",
  troubleshooting: "systematic diagnosis of an unclear problem",
  experience_based: "something only real hands-on experience reveals",
  practical_workflow: "the real end-to-end workflow they would follow",
  comparison: "comparing approaches/tools and when to use each",
  follow_up: "a deeper probe into the candidate's previous answer",
};

export interface GenerateQuestionContext {
  request: SkillRequest;
  experienceLevel: ExperienceLevel;
  targetDifficulty: Difficulty;
  desiredType: QuestionType;
  questionIndex: number;
  totalQuestions: number;
  estimate: SkillEstimate;
  previousQuestions: InterviewQuestion[];
  lastAnswer?: { question: string; answer: string; evaluation: AnswerEvaluation };
  /** Languages to produce the question in; first is primary. */
  languages: string[];
}

/**
 * Builds the question-generation prompt. Returns a strict-JSON instruction so
 * the engine can separate the shown `prompt` from the internal `intent` and
 * `scoringRubric`.
 */
export function generateQuestionPrompt(ctx: GenerateQuestionContext): {
  system: string;
  user: string;
} {
  const askedSummary =
    ctx.previousQuestions.length === 0
      ? "None yet."
      : ctx.previousQuestions
          .map((q, i) => `${i + 1}. (${q.type}/${q.difficulty}) ${q.prompt}`)
          .join("\n");

  const followUpBlock = ctx.lastAnswer
    ? `The candidate's PREVIOUS question was: "${ctx.lastAnswer.question}"
Their answer was: "${ctx.lastAnswer.answer}"
Internal note on that answer (do NOT reveal): ${ctx.lastAnswer.evaluation.reasoning}
If a follow-up would meaningfully test them further (especially if the answer was strong-but-shallow, vague, or possibly memorised), you MAY ask a natural follow-up that references what they said.`
    : "This is the first question.";

  const [primaryLang, ...otherLangs] = ctx.languages;
  const translationBlock =
    otherLangs.length === 0
      ? ""
      : `\n\nThis interview is multilingual. Provide the question in ${primaryLang} as "prompt", and ALSO provide a faithful, natural translation for each of these languages as "promptTranslations" (keyed by language name): ${otherLangs.join(
          ", ",
        )}. Keep technical terms/tool names accurate; do not translate proper nouns or code identifiers. The candidate may answer in any of: ${ctx.languages.join(
          ", ",
        )}.`;
  const translationJson =
    otherLangs.length === 0
      ? ""
      : `\n  "promptTranslations": { ${otherLangs
          .map((l) => `"${l}": "the question translated into ${l}"`)
          .join(", ")} },`;

  return {
    system: INTERVIEWER_PERSONA,
    user: `Generate the NEXT interview question.

Skill: ${ctx.request.skill}
Category: ${ctx.request.category}${ctx.request.subSkill ? `\nSub-skill focus: ${ctx.request.subSkill}` : ""}
Candidate self-described level: ${ctx.experienceLevel}
This is question ${ctx.questionIndex + 1} of ${ctx.totalQuestions}.
Target difficulty: ${ctx.targetDifficulty}
Desired question type: ${ctx.desiredType} (${TYPE_GUIDE[ctx.desiredType]})

Current internal estimate of the candidate (do NOT reveal): skillLevel=${ctx.estimate.skillLevel}, confidence=${ctx.estimate.confidence}, knowledge=${ctx.estimate.knowledge}, experience=${ctx.estimate.professionalExperience}.
Adapt: if they are struggling, ease off; if they are excelling, push deeper.

Questions already asked (do NOT repeat or closely paraphrase any of these):
${askedSummary}

${followUpBlock}${translationBlock}

Rules:
- Prefer concrete, scenario / real-customer framing over "What is X?" definitions.
- Make it specific to ${ctx.request.skill}. Use realistic numbers, tools, and situations.
- One question only. No multi-part interrogations.
- Do NOT reveal scoring or your intent.

Respond with ONLY a JSON object, no prose, in exactly this shape:
{
  "prompt": "the question text in ${primaryLang}",${translationJson}
  "type": "${ctx.desiredType}",
  "difficulty": "${ctx.targetDifficulty}",
  "isFollowUp": true | false,
  "intent": "1 sentence: what this question is designed to reveal (internal)",
  "scoringRubric": "2-4 short bullets describing what a strong answer contains (internal)"
}`,
  };
}

export interface EvaluateAnswerContext {
  request: SkillRequest;
  experienceLevel: ExperienceLevel;
  question: InterviewQuestion;
  answer: string;
  priorAnswers: { question: string; answer: string }[];
  estimate: SkillEstimate;
  /** Languages the candidate may answer in; first is primary. */
  languages: string[];
}

export function evaluateAnswerPrompt(ctx: EvaluateAnswerContext): {
  system: string;
  user: string;
} {
  const history =
    ctx.priorAnswers.length === 0
      ? "None."
      : ctx.priorAnswers
          .map((p, i) => `Q${i + 1}: ${p.question}\nA${i + 1}: ${p.answer}`)
          .join("\n");

  const multilingual = ctx.languages.length > 1;
  const langNote = multilingual
    ? `\n\nThe candidate may answer in ${ctx.languages.join(
        ", ",
      )}, or mix them, or use a different script. Judge the MEANING of the answer, never the language or script it is written in — an excellent answer in ${ctx.languages
        .slice(1)
        .join(" or ")} must score exactly as highly as the same answer in ${
        ctx.languages[0]
      }. Do not penalise code-switching or transliteration.`
    : "";
  const replyNote = multilingual
    ? ` Write "interviewerReply" in ${ctx.languages.join(
        " and ",
      )} (the ${ctx.languages[0]} version first, then a blank line, then the other language(s)).`
    : "";

  return {
    system: `${INTERVIEWER_PERSONA}

You are now privately evaluating an answer using SEMANTIC REASONING — never keyword matching, never literal string comparison. Reward real-world correctness, practical judgement, and professional thinking. Penalise vagueness and confidently-wrong answers. Be fair to non-native speakers: judge substance over phrasing.${langNote}`,
    user: `Skill: ${ctx.request.skill} (category: ${ctx.request.category})
Candidate self-described level: ${ctx.experienceLevel}

The question asked:
"${ctx.question.prompt}"
Internal intent: ${ctx.question.intent}
Internal rubric: ${ctx.question.scoringRubric}

The candidate's answer:
"${ctx.answer}"

Earlier answers in this interview (for memory, consistency and cheat detection):
${history}

Evaluate the answer on each dimension from 0 to 10 using reasoning:
- technicalKnowledge, practicalSkill, problemSolving, communication, confidence, safetyBestPractices.

Also assess integrity signals:
- aiGeneratedLikelihood (0.0–1.0): does this read like pasted AI / canned text rather than a practitioner speaking?
- repeated (bool): does it materially repeat an earlier answer?
- contradictory (bool): does it contradict something said earlier?
- generic (bool): is it vague filler with no concrete substance?

Then write "interviewerReply": a short, warm, natural reply to show the candidate — appreciate genuinely strong points, or gently challenge / ask them to be concrete if weak. NEVER mention scores, rubrics, or that you are evaluating. Keep it to 1–3 sentences.${replyNote}

Set "wantsFollowUp" true only if a follow-up would meaningfully clarify a vague or possibly-memorised answer.

Respond with ONLY a JSON object in exactly this shape:
{
  "dimensions": {
    "technicalKnowledge": 0,
    "practicalSkill": 0,
    "problemSolving": 0,
    "communication": 0,
    "confidence": 0,
    "safetyBestPractices": 0
  },
  "cheat": {
    "aiGeneratedLikelihood": 0.0,
    "repeated": false,
    "contradictory": false,
    "generic": false
  },
  "reasoning": "1-2 sentences, internal only",
  "interviewerReply": "what to show the candidate",
  "wantsFollowUp": false
}`,
  };
}

export interface FinalReportContext {
  request: SkillRequest;
  experienceLevel: ExperienceLevel;
  professionalScore: number;
  dimensionScores: {
    knowledge: number;
    practicalSkill: number;
    problemSolving: number;
    communication: number;
    confidence: number;
    safety: number;
  };
  estimate: SkillEstimate;
  questionsAsked: number;
  averageAiLikelihood: number;
  /** Languages for the closing message; first is primary. */
  languages: string[];
}

/**
 * The numeric report is computed deterministically in `scoring.ts`. This prompt
 * only asks the model for the qualitative parts: strengths, improvements, and a
 * human-readable experience prediction. That keeps scores reproducible while
 * still giving a natural, tailored narrative.
 */
export function finalNarrativePrompt(ctx: FinalReportContext): {
  system: string;
  user: string;
} {
  return {
    system: `${INTERVIEWER_PERSONA}

You are writing the qualitative part of a certification report. Be specific to this skill and grounded in the candidate's demonstrated level. Do not invent achievements.`,
    user: `Skill: ${ctx.request.skill} (category: ${ctx.request.category})
Candidate self-described level: ${ctx.experienceLevel}
Questions asked: ${ctx.questionsAsked}

Computed dimension scores (0–100):
knowledge=${ctx.dimensionScores.knowledge}, practical=${ctx.dimensionScores.practicalSkill}, problemSolving=${ctx.dimensionScores.problemSolving}, communication=${ctx.dimensionScores.communication}, confidence=${ctx.dimensionScores.confidence}, safety=${ctx.dimensionScores.safety}.
Overall professional score: ${ctx.professionalScore}/100.
Internal experience estimate: ${ctx.estimate.professionalExperience}/100.

Also write "closingMessage": a warm 1–2 sentence sign-off to show the candidate now that the interview is over (do NOT reveal scores or numbers).${
      ctx.languages.length > 1
        ? ` Write it in ${ctx.languages.join(
            " and ",
          )} — the ${ctx.languages[0]} version first, then a blank line, then the other language(s).`
        : ""
    }

Produce ONLY a JSON object:
{
  "strengths": ["3-5 concise, specific strengths grounded in this skill"],
  "improvements": ["2-4 concise, specific areas to improve"],
  "experiencePrediction": "a realistic range like '2-4 Years' consistent with the scores",
  "closingMessage": "the sign-off to show the candidate"
}`,
  };
}
