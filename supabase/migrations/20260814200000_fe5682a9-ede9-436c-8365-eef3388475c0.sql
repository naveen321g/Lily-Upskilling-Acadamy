-- ============ PRODUCTION HARDENING ============

-- Certificate storage bucket had no size/type limits — the app already
-- validates client-side and (as of this same change) server-side in
-- validateUploadedFile(), but enforcing it at the bucket level too means a
-- bad upload never lands in storage in the first place, regardless of how
-- it was uploaded.
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB, matches MAX_CERTIFICATE_FILE_BYTES in certificate-shared.ts
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg']
WHERE id = 'certificates';

-- `profiles` had no owner check on SELECT at all (`USING (true)`), letting
-- any signed-in candidate read every other user's profile row, including
-- their role. Every legitimate cross-user profile lookup in the app already
-- happens through an assertAdmin()-gated admin function, so tightening this
-- to "own row or admin" changes nothing for real usage.
DROP POLICY "Profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Users read their own profile, admins read all" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
