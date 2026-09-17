-- ============ SERVICE / TRADE SKILLS FOR AI INTERVIEW ============
-- The AI Interview picker is now filtered to a curated slug allowlist
-- (INTERVIEW_SKILL_SLUGS in src/lib/interview-shared.ts) so it shows these
-- service/trade skills instead of the existing tech-oriented catalog used by
-- the MCQ assessment system. These are plain additions to the shared
-- `skills` table — nothing existing is modified or removed, and every
-- existing skill stays exactly as it was for assessments/My Skills.
INSERT INTO public.skills (slug, name, category, difficulty, icon_key, description, is_active) VALUES
  ('plumbing', 'Plumbing', 'Home Services', 'Intermediate', 'Wrench', 'Diagnosing and fixing pipes, fixtures and water systems in real homes.', true),
  ('electrician', 'Electrician', 'Home Services', 'Intermediate', 'Zap', 'Safe wiring, fault-finding and electrical installation work.', true),
  ('makeup-artist', 'Makeup Artist', 'Beauty & Wellness', 'Intermediate', 'Brush', 'Makeup application for clients across everyday, bridal and event looks.', true),
  ('graphic-designing', 'Graphic Designing', 'Creative', 'Intermediate', 'Palette', 'Visual design work for branding, print and digital media.', true),
  ('photography', 'Photography', 'Creative', 'Intermediate', 'Camera', 'Shooting and composing photographs across events, portraits or products.', true),
  ('photo-editing', 'Photo Editing', 'Creative', 'Intermediate', 'Image', 'Retouching, colour grading and post-processing photographs.', true),
  ('video-editing', 'Video Editing', 'Creative', 'Intermediate', 'Film', 'Cutting, grading and assembling raw footage into finished video.', true),
  ('tutoring', 'Tutoring', 'Education', 'Beginner', 'BookOpen', 'One-on-one or small-group academic teaching and exam prep.', true),
  ('videography', 'Videography', 'Creative', 'Intermediate', 'Video', 'Filming events, interviews and promotional video on location.', true),
  ('app-development', 'App Development', 'Tech Services', 'Advanced', 'Smartphone', 'Building mobile applications for clients end to end.', true),
  ('aptitude-training', 'Aptitude Training', 'Education', 'Beginner', 'Calculator', 'Coaching learners on quantitative and logical aptitude for exams and interviews.', true),
  ('appliance-repairing', 'Appliance Repairing', 'Home Services', 'Intermediate', 'Wrench', 'Diagnosing and repairing household appliances.', true),
  ('coaching', 'Coaching', 'Education', 'Beginner', 'Users', 'Personal or professional coaching and mentorship.', true),
  ('skin-and-body-care', 'Skin & Body Care', 'Beauty & Wellness', 'Intermediate', 'Heart', 'Skincare and body-care treatments for clients.', true),
  ('cleaning', 'Cleaning', 'Home Services', 'Beginner', 'SprayCan', 'Residential and commercial cleaning work.', true),
  ('cooking', 'Cooking', 'Culinary', 'Intermediate', 'ChefHat', 'Meal preparation and cooking for clients or events.', true),
  ('website-development', 'Website Development', 'Tech Services', 'Advanced', 'Globe', 'Building and maintaining websites for clients end to end.', true),
  ('ac-servicing', 'AC Servicing', 'Home Services', 'Intermediate', 'Snowflake', 'Installation, servicing and repair of air conditioning units.', true),
  ('driving', 'Driving', 'Transport', 'Beginner', 'Car', 'Professional driving services.', true),
  ('consultation', 'Consultation', 'Professional Services', 'Intermediate', 'MessageCircle', 'Advisory and consultation services for clients.', true),
  ('fitness-training', 'Fitness Training', 'Health & Fitness', 'Intermediate', 'Dumbbell', 'Personal training and fitness coaching for clients.', true),
  ('cake-and-baked-goods-making', 'Cake & Baked Goods Making', 'Culinary', 'Intermediate', 'Cake', 'Baking and decorating cakes and other baked goods for clients.', true)
ON CONFLICT (slug) DO NOTHING;
