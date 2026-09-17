-- ============ BADGES ============
-- Real, revocable records backing the "AI Skill Verified" / "Certification Verified"
-- badges. Issued by server-side logic (passing an expert assessment, an approved
-- certificate upload) — never inserted directly by a client.
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  issued_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoke_reason text,
  UNIQUE (user_id, skill_id, type)
);
CREATE INDEX badges_user_idx ON public.badges (user_id);
GRANT SELECT ON public.badges TO authenticated;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own badges" ON public.badges FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins read all badges" ON public.badges FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
