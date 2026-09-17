-- ============ CERTIFICATE REVIEW (manual certificate upload) ============
ALTER TABLE public.certificates
  ADD COLUMN source text NOT NULL DEFAULT 'ai',
  ADD COLUMN status text NOT NULL DEFAULT 'approved',
  ADD COLUMN file_path text,
  ADD COLUMN reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN reviewed_at timestamptz,
  ADD COLUMN review_notes text;

-- Existing rows are all AI-issued and already public/approved; the defaults above cover them.

-- Public verification must now also require the certificate to have cleared review.
DROP POLICY "Public certificates are verifiable" ON public.certificates;
CREATE POLICY "Public certificates are verifiable" ON public.certificates FOR SELECT
  USING (is_public AND status = 'approved');

CREATE POLICY "Admins read all certificates" ON public.certificates FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins review certificates" ON public.certificates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ CERTIFICATE FILE STORAGE ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload their own certificate files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read their own certificate files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'certificates' AND (storage.foldername(name))[1] = auth.uid()::text);
