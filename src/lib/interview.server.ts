import {
  adaptDifficulty,
  aggregateScores,
  baselineDifficulty,
  buildReport,
  chooseQuestionType,
  createEngineConfig,
  evaluateAnswer,
  finalNarrativePrompt,
  generateQuestion,
  GroqClient,
  initialEstimate,
  sanitizeCandidateInput,
  updateEstimate,
  welcomePrompt,
  type AnswerEvaluation,
  type ChatMessage,
  type InterviewQuestion,
  type LLMClient,
  type SkillEstimate,
  type SkillRequest,
} from "./interview-engine";
import { parseJsonObject } from "./interview-engine/utils/json";
import {
  INTERVIEW_SKILL_SLUGS,
  type InterviewChatMessage,
  type InterviewExperienceLevel,
  type InterviewPhase,
  type InterviewReport,
  type InterviewSessionDetail,
  type InterviewSessionStatus,
  type InterviewSessionSummary,
  type InterviewSkillOption,
} from "./interview-shared";

// `interview_sessions` was added by a hand-written migration and isn't in
// the generated Database type yet — same situation as retake_requests etc.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

interface SessionRow {
  id: string;
  user_id: string;
  skill_id: string;
  sub_skill: string | null;
  experience_level: string | null;
  phase: string;
  planned_question_count: number;
  questions: InterviewQuestion[];
  evaluations: AnswerEvaluation[];
  messages: ChatMessage[];
  estimate: SkillEstimate;
  report: InterviewReport | null;
  status: string;
  created_at: string;
  updated_at: string;
  skills?: { name: string; category: string } | null;
}

const SESSION_COLUMNS =
  "id, user_id, skill_id, sub_skill, experience_level, phase, planned_question_count, questions, evaluations, messages, estimate, report, status, created_at, updated_at, skills(name, category)";

function getClient(): LLMClient {
  const config = createEngineConfig();
  if (!config.apiKey) {
    throw new Error("AI Interview isn't configured yet. Please check back later.");
  }
  return new GroqClient({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
  });
}

function skillRequestFrom(row: SessionRow): SkillRequest {
  return {
    skill: row.skills?.name ?? "Skill",
    category: row.skills?.category ?? "General",
    subSkill: row.sub_skill ?? undefined,
  };
}

function toWireMessage(m: ChatMessage): InterviewChatMessage {
  return {
    id: m.id,
    role: m.role === "system" ? "assistant" : m.role,
    content: m.content,
    questionId: m.questionId,
    createdAt: new Date(m.createdAt).toISOString(),
  };
}

function toSummary(row: SessionRow): InterviewSessionSummary {
  return {
    id: row.id,
    skillId: row.skill_id,
    skillName: row.skills?.name ?? "Skill",
    status: row.status as InterviewSessionStatus,
    phase: row.phase as InterviewPhase,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    professionalScore: row.report?.professionalScore ?? null,
    approved: row.report?.approved ?? null,
  };
}

function toDetail(row: SessionRow): InterviewSessionDetail {
  return {
    ...toSummary(row),
    experienceLevel: (row.experience_level as InterviewExperienceLevel) ?? null,
    plannedQuestionCount: row.planned_question_count,
    messages: (row.messages ?? []).map(toWireMessage),
    progress:
      row.planned_question_count > 0
        ? Math.min(1, (row.evaluations ?? []).length / row.planned_question_count)
        : 0,
    report: row.report,
    awaitingAnswer: row.phase === "asking",
  };
}

function trailingFollowUpCount(questions: InterviewQuestion[]): number {
  let n = 0;
  for (let i = questions.length - 1; i >= 0; i--) {
    if (questions[i].isFollowUp) n++;
    else break;
  }
  return n;
}

async function loadOwnSession(db: Db, userId: string, sessionId: string): Promise<SessionRow> {
  const { data, error } = await db
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error("Interview session not found");
  return data as SessionRow;
}

/**
 * The curated service/trade skill list for the interview skill-entry screen
 * — deliberately not the full skill catalog (see INTERVIEW_SKILL_SLUGS).
 */
export async function listInterviewSkills(db: Db): Promise<InterviewSkillOption[]> {
  const { data, error } = await db
    .from("skills")
    .select("id, name, category, icon_key")
    .eq("is_active", true)
    .in("slug", INTERVIEW_SKILL_SLUGS)
    .order("name");
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (s: { id: string; name: string; category: string; icon_key: string }) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      iconKey: s.icon_key,
    }),
  );
}

/** Start a new interview: writes the welcome + experience-question messages and creates the row. */
export async function startInterviewSession(
  db: Db,
  userId: string,
  args: { skillId: string; subSkill?: string },
): Promise<InterviewSessionDetail> {
  // Resume an existing unfinished session for this skill instead of piling up
  // a new row (and a new LLM call) every time "Start AI Interview" is clicked.
  const { data: existing } = await db
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .eq("skill_id", args.skillId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return toDetail(existing as SessionRow);

  const llm = getClient();
  const { data: skill, error: skillError } = await db
    .from("skills")
    .select("name, category")
    .eq("id", args.skillId)
    .eq("is_active", true)
    .single();
  if (skillError || !skill) throw new Error("That skill isn't available for an AI interview.");

  const request: SkillRequest = {
    skill: skill.name,
    category: skill.category,
    subSkill: args.subSkill,
  };
  const config = createEngineConfig();

  const { system, user } = welcomePrompt(request, config.languages);
  const welcomeText = await llm.complete({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.6,
    maxTokens: 400,
  });

  const now = Date.now();
  const messages: ChatMessage[] = [
    {
      id: `m_${now}_1`,
      role: "assistant",
      content: welcomeText.trim(),
      createdAt: now,
      meta: true,
    },
    {
      id: `m_${now}_2`,
      role: "assistant",
      content: "Before we dive in — how would you describe yourself with this skill?",
      createdAt: now + 1,
      meta: true,
    },
  ];

  const { data: created, error } = await db
    .from("interview_sessions")
    .insert({
      user_id: userId,
      skill_id: args.skillId,
      sub_skill: args.subSkill ?? null,
      phase: "awaiting_experience",
      status: "in_progress",
      questions: [],
      evaluations: [],
      messages,
      estimate: initialEstimate(),
    })
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toDetail(created as SessionRow);
}

/** Record the candidate's self-described experience level and ask the first question. */
export async function setInterviewExperience(
  db: Db,
  userId: string,
  sessionId: string,
  level: InterviewExperienceLevel,
): Promise<InterviewSessionDetail> {
  const llm = getClient();
  const row = await loadOwnSession(db, userId, sessionId);
  if (row.phase !== "awaiting_experience") return toDetail(row);

  const config = createEngineConfig();
  const plannedQuestionCount =
    level === "beginner" ? config.beginnerQuestionCount : config.experiencedQuestionCount;
  const request = skillRequestFrom(row);

  const now = Date.now();
  const messages: ChatMessage[] = [
    ...row.messages,
    { id: `m_${now}_u`, role: "user", content: capitalize(level), createdAt: now },
  ];

  const question = await generateQuestion(llm, {
    request,
    experienceLevel: level,
    targetDifficulty: baselineDifficulty(0, plannedQuestionCount),
    desiredType: chooseQuestionType([], 0),
    questionIndex: 0,
    totalQuestions: plannedQuestionCount,
    estimate: initialEstimate(),
    previousQuestions: [],
    languages: config.languages,
  });
  messages.push({
    id: `m_${now}_q`,
    role: "assistant",
    content: question.displayPrompt || question.prompt,
    questionId: question.id,
    createdAt: now + 1,
  });

  const { data: updated, error } = await db
    .from("interview_sessions")
    .update({
      experience_level: level,
      planned_question_count: plannedQuestionCount,
      phase: "asking",
      questions: [question],
      messages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toDetail(updated as SessionRow);
}

/** Submit an answer: evaluate it, then either ask the next question or finalize the report. */
export async function submitInterviewAnswer(
  db: Db,
  userId: string,
  sessionId: string,
  rawAnswer: string,
): Promise<InterviewSessionDetail> {
  const llm = getClient();
  const row = await loadOwnSession(db, userId, sessionId);
  if (row.phase !== "asking" || !row.experience_level) return toDetail(row);

  const config = createEngineConfig();
  const request = skillRequestFrom(row);
  const experienceLevel = row.experience_level as InterviewExperienceLevel;
  const currentQuestion = row.questions.at(-1);
  if (!currentQuestion) return toDetail(row);

  const { text } = sanitizeCandidateInput(rawAnswer);
  const now = Date.now();
  const messages: ChatMessage[] = [
    ...row.messages,
    {
      id: `m_${now}_u`,
      role: "user",
      content: rawAnswer,
      questionId: currentQuestion.id,
      createdAt: now,
    },
  ];

  const priorAnswers = row.questions.slice(0, -1).map((q) => {
    const ans = row.messages.find((m) => m.role === "user" && m.questionId === q.id);
    return { question: q.prompt, answer: ans?.content ?? "" };
  });

  const evaluation = await evaluateAnswer(
    llm,
    currentQuestion,
    {
      request,
      experienceLevel,
      question: currentQuestion,
      answer: text,
      priorAnswers,
      estimate: row.estimate,
      languages: config.languages,
    },
    config.evalModel,
  );

  const estimate = updateEstimate(row.estimate, evaluation);
  const evaluations = [...row.evaluations, evaluation];
  messages.push({
    id: `m_${now}_r`,
    role: "assistant",
    content: evaluation.interviewerReply,
    createdAt: now + 1,
  });

  if (row.questions.length >= row.planned_question_count) {
    return finalizeInterview(db, userId, sessionId, {
      request,
      experienceLevel,
      evaluations,
      estimate,
      messages,
      questions: row.questions,
      languages: config.languages,
    });
  }

  const wantsFollowUp = evaluation.wantsFollowUp && trailingFollowUpCount(row.questions) < 2;
  const index = row.questions.length;
  const baseline = baselineDifficulty(index, row.planned_question_count);
  const targetDifficulty = adaptDifficulty(baseline, estimate, evaluation);
  const desiredType = wantsFollowUp
    ? "follow_up"
    : chooseQuestionType(
        row.questions.map((q) => q.type),
        index,
      );
  const lastAnswerMsg = messages.find(
    (m) => m.role === "user" && m.questionId === currentQuestion.id,
  );

  const nextQuestion = await generateQuestion(llm, {
    request,
    experienceLevel,
    targetDifficulty,
    desiredType,
    questionIndex: index,
    totalQuestions: row.planned_question_count,
    estimate,
    previousQuestions: row.questions,
    languages: config.languages,
    lastAnswer: lastAnswerMsg
      ? { question: currentQuestion.prompt, answer: lastAnswerMsg.content, evaluation }
      : undefined,
  });
  messages.push({
    id: `m_${now}_q`,
    role: "assistant",
    content: nextQuestion.displayPrompt || nextQuestion.prompt,
    questionId: nextQuestion.id,
    createdAt: now + 2,
  });

  const { data: updated, error } = await db
    .from("interview_sessions")
    .update({
      questions: [...row.questions, nextQuestion],
      evaluations,
      estimate,
      messages,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toDetail(updated as SessionRow);
}

async function finalizeInterview(
  db: Db,
  userId: string,
  sessionId: string,
  args: {
    request: SkillRequest;
    experienceLevel: InterviewExperienceLevel;
    evaluations: AnswerEvaluation[];
    estimate: SkillEstimate;
    messages: ChatMessage[];
    questions: InterviewQuestion[];
    languages: string[];
  },
): Promise<InterviewSessionDetail> {
  const llm = getClient();
  const aggregate = aggregateScores(args.evaluations, createEngineConfig().weights);

  let strengths: string[] = [];
  let improvements: string[] = [];
  let experiencePrediction = "Unknown";
  let closingMessage = "";
  try {
    const { system, user } = finalNarrativePrompt({
      request: args.request,
      experienceLevel: args.experienceLevel,
      professionalScore: aggregate.professionalScore,
      dimensionScores: {
        knowledge: aggregate.knowledge,
        practicalSkill: aggregate.practicalSkill,
        problemSolving: aggregate.problemSolving,
        communication: aggregate.communication,
        confidence: aggregate.confidence,
        safety: aggregate.safety,
      },
      estimate: args.estimate,
      questionsAsked: args.questions.length,
      averageAiLikelihood: aggregate.averageAiLikelihood,
      languages: args.languages,
    });
    const raw = await llm.complete({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
      maxTokens: 800,
      json: true,
    });
    const parsed = parseJsonObject<{
      strengths: string[];
      improvements: string[];
      experiencePrediction: string;
      closingMessage?: string;
    }>(raw);
    strengths = parsed.strengths ?? [];
    improvements = parsed.improvements ?? [];
    experiencePrediction = parsed.experiencePrediction ?? "Unknown";
    closingMessage = (parsed.closingMessage ?? "").trim();
  } catch {
    // Deterministic score/report still stand even if the narrative call fails.
  }

  const report = buildReport({
    request: args.request,
    aggregate,
    questionsAsked: args.questions.length,
    strengths,
    improvements,
    experiencePrediction,
  });

  const fallbackClosing = report.approved
    ? `That's everything I needed — thank you. You came across as ${report.level.toLowerCase()} level for ${report.skill}. I've prepared your summary below.`
    : `Thanks for taking the time. Based on our conversation I've put together a summary with where you're strong and where a bit more practice would help.`;

  const now = Date.now();
  const messages: ChatMessage[] = [
    ...args.messages,
    {
      id: `m_${now}_c`,
      role: "assistant",
      content: closingMessage || fallbackClosing,
      createdAt: now,
      meta: true,
    },
  ];

  const { data: updated, error } = await db
    .from("interview_sessions")
    .update({
      evaluations: args.evaluations,
      estimate: args.estimate,
      messages,
      phase: "completed",
      status: "completed",
      report,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select(SESSION_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toDetail(updated as SessionRow);
}

export async function getInterviewSessionRow(
  db: Db,
  userId: string,
  sessionId: string,
): Promise<InterviewSessionDetail> {
  return toDetail(await loadOwnSession(db, userId, sessionId));
}

export async function listMyInterviewSessionsRows(
  db: Db,
  userId: string,
): Promise<InterviewSessionSummary[]> {
  const { data, error } = await db
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: SessionRow) => toSummary(row));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
