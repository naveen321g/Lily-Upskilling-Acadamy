-- ============ AI INTERVIEW SESSIONS ============
-- A fully separate verification path from the MCQ assessment system
-- (assessment_attempts/questions): a dynamic, LLM-driven conversational
-- interview. Each row is one interview session for one candidate on one
-- skill; the full transcript/questions/evaluations/report are stored as
-- jsonb since the shape comes from the ported interview-engine types, not a
-- normalized schema (mirrors how ai_feedback is stored on
-- assessment_attempts). v1 does not touch certificates/badges/user_skills —
-- a completed interview produces a report the candidate can view, nothing
-- more, per the explicit v1 scope decision.
CREATE TABLE public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  sub_skill text,
  experience_level text,
  phase text NOT NULL DEFAULT 'awaiting_experience',
  planned_question_count integer NOT NULL DEFAULT 0,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  evaluations jsonb NOT NULL DEFAULT '[]'::jsonb,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  estimate jsonb NOT NULL DEFAULT '{"skillLevel":50,"confidence":50,"knowledge":50,"professionalExperience":50}'::jsonb,
  report jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_sessions_user_idx ON public.interview_sessions (user_id);
CREATE INDEX interview_sessions_user_skill_idx ON public.interview_sessions (user_id, skill_id);
GRANT SELECT, INSERT, UPDATE ON public.interview_sessions TO authenticated;
GRANT ALL ON public.interview_sessions TO service_role;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own interview sessions" ON public.interview_sessions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own interview sessions" ON public.interview_sessions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own interview sessions" ON public.interview_sessions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
