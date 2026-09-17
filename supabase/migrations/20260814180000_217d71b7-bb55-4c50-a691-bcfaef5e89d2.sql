-- ============ RETAKE REQUESTS ============
-- Candidates get 3 attempts per skill+level (enforced in application code in
-- startAttempt). Once used up, a candidate can request approval for one more
-- attempt (spec: "approve assessment retakes for valid reasons"). Approving
-- grants exactly one extra attempt — `consumed_at` is set the moment that
-- extra attempt is actually started, so a single approval can't be reused.
CREATE TABLE public.retake_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level text NOT NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX retake_requests_user_idx ON public.retake_requests (user_id);
CREATE INDEX retake_requests_status_idx ON public.retake_requests (status);
CREATE INDEX retake_requests_lookup_idx ON public.retake_requests (user_id, skill_id, level, status);
GRANT SELECT, INSERT, UPDATE ON public.retake_requests TO authenticated;
GRANT ALL ON public.retake_requests TO service_role;
ALTER TABLE public.retake_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own retake requests" ON public.retake_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own retake requests" ON public.retake_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins read all retake requests" ON public.retake_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update retake requests" ON public.retake_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
-- The candidate's own client also needs to set consumed_at the moment they
-- start their approved extra attempt (inside startAttempt, RLS-scoped).
CREATE POLICY "Users consume their own approved retake" ON public.retake_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'approved')
  WITH CHECK (auth.uid() = user_id AND status = 'approved');
