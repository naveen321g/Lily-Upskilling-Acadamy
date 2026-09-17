-- ============ SKILL REQUESTS ============
-- Candidate-submitted requests for a skill that doesn't exist in the catalog
-- yet (spec: "Skill Management" — Add/Remove/View + request a new skill).
-- Reviewed by an admin, who either creates the matching `skills` row and
-- marks the request approved, or rejects it with a reason.
CREATE TABLE public.skill_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  resulting_skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX skill_requests_user_idx ON public.skill_requests (user_id);
CREATE INDEX skill_requests_status_idx ON public.skill_requests (status);
GRANT SELECT, INSERT, UPDATE ON public.skill_requests TO authenticated;
GRANT ALL ON public.skill_requests TO service_role;
ALTER TABLE public.skill_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own skill requests" ON public.skill_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own skill requests" ON public.skill_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins read all skill requests" ON public.skill_requests FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update skill requests" ON public.skill_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============ BACKFILL: user_skills for certificate/badge-only history ============
-- `getMySkills` is moving from "every catalog skill" to "only skills the
-- candidate has added" (sourced from user_skills). Assessment attempts
-- already upsert a user_skills row; a certificate approved without ever
-- taking an assessment does not. Backfill those gaps so nobody's existing
-- verified skill silently disappears from their portfolio. Skips any
-- (user_id, skill_id) that already has a row.
INSERT INTO public.user_skills (user_id, skill_id, status, completion, trust, verifications, progress)
SELECT DISTINCT c.user_id, c.skill_id, 'verified', 100, 60, ARRAY['certificate'],
  '{"identity":100,"assessment":0,"expert":0,"certificate":100,"employer":"not_started"}'::jsonb
FROM public.certificates c
WHERE c.status = 'approved' AND c.skill_id IS NOT NULL
ON CONFLICT (user_id, skill_id) DO NOTHING;

INSERT INTO public.user_skills (user_id, skill_id, status, completion, trust, verifications, progress)
SELECT DISTINCT b.user_id, b.skill_id, 'verified', 100, 60, ARRAY[b.type],
  '{"identity":100,"assessment":0,"expert":0,"certificate":0,"employer":"not_started"}'::jsonb
FROM public.badges b
WHERE b.status = 'active'
ON CONFLICT (user_id, skill_id) DO NOTHING;
