-- ============ ASSESSMENT ATTEMPTS: ADMIN UPDATE + FLAGGING ============
-- `assessment_attempts` has never had an RLS policy letting an admin UPDATE a
-- row they don't own (only "Users update their own attempts" exists) — the
-- existing admin "Reset attempt" action has been relying on this missing
-- policy and would silently affect 0 rows for any candidate's attempt. Add
-- the missing policy, and add the columns needed for admins to flag a
-- suspicious attempt for review (spec: "review suspicious assessment
-- attempts to ensure fairness and integrity").
CREATE POLICY "Admins update all attempts" ON public.assessment_attempts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.assessment_attempts ADD COLUMN flagged boolean NOT NULL DEFAULT false;
ALTER TABLE public.assessment_attempts ADD COLUMN flag_reason text;
CREATE INDEX assessment_attempts_flagged_idx ON public.assessment_attempts (flagged) WHERE flagged;
