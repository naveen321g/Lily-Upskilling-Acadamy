-- ============ BADGE APPEALS ============
-- Candidate-submitted disputes of a revoked badge (spec: "handle badge-related
-- appeals to maintain the integrity and credibility of the verification
-- system"). Reviewed by an admin, who either reissues the badge (approve) or
-- upholds the revocation (reject) with a reason shown back to the candidate.
CREATE TABLE public.badge_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX badge_appeals_user_idx ON public.badge_appeals (user_id);
CREATE INDEX badge_appeals_status_idx ON public.badge_appeals (status);
CREATE INDEX badge_appeals_badge_idx ON public.badge_appeals (badge_id);
-- Admin review always goes through the service-role client (same as
-- badges.revoke/reissue already do — `badges` itself has no admin UPDATE RLS
-- policy either), so `authenticated` only needs read/insert for candidates.
GRANT SELECT, INSERT ON public.badge_appeals TO authenticated;
GRANT ALL ON public.badge_appeals TO service_role;
ALTER TABLE public.badge_appeals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own badge appeals" ON public.badge_appeals FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own badge appeals" ON public.badge_appeals FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.badges b WHERE b.id = badge_id AND b.user_id = auth.uid())
  );
CREATE POLICY "Admins read all badge appeals" ON public.badge_appeals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
