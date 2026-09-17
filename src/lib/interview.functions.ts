import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  InterviewSessionDetail,
  InterviewSessionSummary,
  InterviewSkillOption,
} from "./interview-shared";
import {
  getInterviewSessionRow,
  listInterviewSkills,
  listMyInterviewSessionsRows,
  setInterviewExperience,
  startInterviewSession,
  submitInterviewAnswer as submitInterviewAnswerRow,
} from "./interview.server";

export const listInterviewSkillOptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InterviewSkillOption[]> => {
    return listInterviewSkills(context.supabase);
  });

export const startInterview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        skillId: z.string().uuid(),
        subSkill: z.string().trim().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<InterviewSessionDetail> => {
    return startInterviewSession(context.supabase, context.userId, data);
  });

export const setInterviewExperienceLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        level: z.enum(["beginner", "experienced"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<InterviewSessionDetail> => {
    return setInterviewExperience(context.supabase, context.userId, data.sessionId, data.level);
  });

export const submitInterviewAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        answer: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<InterviewSessionDetail> => {
    return submitInterviewAnswerRow(context.supabase, context.userId, data.sessionId, data.answer);
  });

export const getInterviewSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<InterviewSessionDetail> => {
    return getInterviewSessionRow(context.supabase, context.userId, data.sessionId);
  });

export const listMyInterviewSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InterviewSessionSummary[]> => {
    return listMyInterviewSessionsRows(context.supabase, context.userId);
  });
