-- ============================================================
-- 20260713101408_5ea210b4-1542-4afd-a54c-ac2081cb7ff9.sql
-- ============================================================

CREATE TYPE public.app_role AS ENUM ('candidate', 'employer', 'reviewer', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role public.app_role NOT NULL DEFAULT 'candidate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 20260713101434_c0d02f3c-241f-4d0c-be06-587db32eae12.sql
-- ============================================================

ALTER FUNCTION public.set_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 20260730075538_3db3f000-4592-4be3-9eac-07c8fbe92663.sql
-- ============================================================
-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can read their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SKILLS CATALOG ============
CREATE TABLE public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  difficulty text NOT NULL DEFAULT 'Intermediate',
  icon_key text NOT NULL DEFAULT 'Sparkles',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.skills TO anon;
GRANT SELECT ON public.skills TO authenticated;
GRANT ALL ON public.skills TO service_role;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Skill catalog is public" ON public.skills FOR SELECT USING (is_active);
CREATE POLICY "Admins manage skills" ON public.skills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER skills_updated_at BEFORE UPDATE ON public.skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ USER SKILLS ============
CREATE TABLE public.user_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  score integer NOT NULL DEFAULT 0,
  completion integer NOT NULL DEFAULT 0,
  trust integer NOT NULL DEFAULT 0,
  verifications text[] NOT NULL DEFAULT '{}',
  progress jsonb NOT NULL DEFAULT '{"identity":0,"assessment":0,"expert":0,"certificate":0,"employer":"not_started"}'::jsonb,
  issued_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;
GRANT ALL ON public.user_skills TO service_role;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own skills" ON public.user_skills FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all user skills" ON public.user_skills FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER user_skills_updated_at BEFORE UPDATE ON public.user_skills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ QUESTION BANK ============
CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'beginner',
  kind text NOT NULL DEFAULT 'mcq',
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  status text NOT NULL DEFAULT 'draft',
  source text NOT NULL DEFAULT 'manual',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_skill_level_idx ON public.questions (skill_id, level, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reviewers and admins read questions" ON public.questions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reviewer'));
CREATE POLICY "Admins manage questions" ON public.questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ASSESSMENT ATTEMPTS ============
CREATE TABLE public.assessment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'beginner',
  question_ids uuid[] NOT NULL DEFAULT '{}',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  submitted_at timestamptz,
  score integer,
  correct_count integer,
  passed boolean,
  ai_feedback jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assessment_attempts_user_idx ON public.assessment_attempts (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.assessment_attempts TO authenticated;
GRANT ALL ON public.assessment_attempts TO service_role;
ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read their own attempts" ON public.assessment_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users create their own attempts" ON public.assessment_attempts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update their own attempts" ON public.assessment_attempts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all attempts" ON public.assessment_attempts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER assessment_attempts_updated_at BEFORE UPDATE ON public.assessment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ CERTIFICATES ============
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id uuid REFERENCES public.skills(id) ON DELETE SET NULL,
  attempt_id uuid REFERENCES public.assessment_attempts(id) ON DELETE SET NULL,
  title text NOT NULL,
  holder_name text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  level text NOT NULL DEFAULT 'Foundational',
  skills text[] NOT NULL DEFAULT '{}',
  verifier text NOT NULL DEFAULT 'Lily Upskilling Academy · AI Evaluation',
  assessment_type text NOT NULL DEFAULT 'AI-evaluated assessment',
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 years'),
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.certificates TO anon;
GRANT SELECT, INSERT, UPDATE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public certificates are verifiable" ON public.certificates FOR SELECT USING (is_public);
CREATE POLICY "Users read their own certificates" ON public.certificates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users insert their own certificates" ON public.certificates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER certificates_updated_at BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SEED: SKILL CATALOG ============
INSERT INTO public.skills (slug, name, category, difficulty, icon_key, description) VALUES
('cybersecurity','Cybersecurity','Cybersecurity','Advanced','Shield','Threat modelling, defence in depth, incident response and secure operations.'),
('python-programming','Python Programming','Programming','Intermediate','Braces','Core Python, data structures, idiomatic patterns and the standard library.'),
('java','Java','Programming','Intermediate','Coffee','JVM fundamentals, OOP design, collections and concurrency.'),
('react-development','React Development','Programming','Advanced','Code2','Component design, hooks, state management and rendering performance.'),
('cloud-computing','Cloud Computing','Cloud','Advanced','Cloud','Cloud architecture, IAM, storage tiers, scaling and cost control.'),
('networking','Networking','Networking','Intermediate','Network','TCP/IP, routing, DNS, subnetting and network troubleshooting.'),
('iot','IoT','IoT','Beginner','Wifi','Embedded sensors, edge gateways, telemetry protocols and device security.'),
('devops','DevOps','DevOps','Advanced','GitBranch','CI/CD, infrastructure as code, containers and observability.'),
('ui-ux-design','UI/UX Design','UI/UX','Intermediate','Palette','User research, information architecture, prototyping and accessibility.'),
('artificial-intelligence','Artificial Intelligence','AI','Expert','Brain','Machine learning foundations, model evaluation and responsible AI.'),
('digital-marketing','Digital Marketing','Digital Marketing','Beginner','Megaphone','SEO, paid acquisition, analytics and lifecycle marketing.'),
('ethical-hacking','Ethical Hacking','Cybersecurity','Advanced','Bug','Reconnaissance, exploitation, privilege escalation and responsible disclosure.');

-- ============ SEED: QUESTIONS — CYBERSECURITY (beginner) ============
INSERT INTO public.questions (skill_id, level, kind, prompt, options, correct_index, explanation, status, source)
SELECT s.id, v.level, v.kind, v.prompt, v.options::jsonb, v.correct_index, v.explanation, 'published', 'manual'
FROM public.skills s, (VALUES
('beginner','mcq','What does the "C" in the CIA triad stand for?','["Confidentiality","Compliance","Continuity","Cryptography"]',0,'The CIA triad is Confidentiality, Integrity and Availability — the three core goals of information security.'),
('beginner','mcq','Which of these is the strongest defence against password reuse attacks?','["Longer usernames","A password manager with unique passwords per site","Changing your password every week","Writing passwords on paper"]',1,'Unique per-site passwords stored in a manager mean a breach at one site cannot unlock another.'),
('beginner','mcq','A phishing email most commonly tries to do what?','["Crash your computer","Trick you into revealing credentials or clicking a malicious link","Encrypt your hard drive instantly","Overload the network"]',1,'Phishing is a social-engineering attack aimed at harvesting credentials or delivering malware via user action.'),
('beginner','mcq','What does multi-factor authentication add beyond a password?','["A second, different category of proof such as a device or biometric","A longer password","An encrypted password field","A CAPTCHA"]',0,'MFA requires evidence from a second category — something you have or are — so a stolen password alone is not enough.'),
('beginner','mcq','Which protocol encrypts web traffic in transit?','["HTTP","FTP","HTTPS/TLS","SMTP"]',2,'HTTPS wraps HTTP in TLS, protecting confidentiality and integrity of data in transit.'),
('beginner','scenario','You receive an urgent message from "IT Support" asking for your password to fix your account. What should you do?','["Reply with the password since it is IT","Ignore it and report it through the official security channel","Change your password and then send the new one","Forward it to colleagues to warn them"]',1,'Legitimate IT never asks for passwords. Report through the official channel rather than replying or forwarding.')
) AS v(level, kind, prompt, options, correct_index, explanation)
WHERE s.slug = 'cybersecurity';

-- ============ SEED: QUESTIONS — CYBERSECURITY (expert) ============
INSERT INTO public.questions (skill_id, level, kind, prompt, options, correct_index, explanation, status, source)
SELECT s.id, v.level, v.kind, v.prompt, v.options::jsonb, v.correct_index, v.explanation, 'published', 'manual'
FROM public.skills s, (VALUES
('expert','mcq','Which control best mitigates lateral movement after an initial workstation compromise?','["Network segmentation with least-privilege access","A stronger antivirus signature set","Longer password expiry windows","Disabling browser cookies"]',0,'Segmentation plus least privilege limits what a compromised host can reach, containing blast radius.'),
('expert','mcq','What is the primary purpose of certificate pinning?','["Speeding up the TLS handshake","Preventing trust in an unexpected but otherwise valid certificate","Compressing certificate chains","Rotating private keys automatically"]',1,'Pinning binds a client to a specific key or issuer so a rogue-but-valid CA certificate is rejected.'),
('expert','mcq','In a SIEM, a very high alert volume with low true-positive rate primarily indicates what?','["Insufficient log retention","Poorly tuned detection rules causing alert fatigue","Missing encryption at rest","An expired TLS certificate"]',1,'Untuned rules generate noise; analysts miss real incidents. Tuning and enrichment raise precision.'),
('expert','mcq','Which statement about zero trust architecture is correct?','["It removes the need for authentication inside the perimeter","It assumes no implicit trust based on network location","It requires a single flat network","It replaces encryption with allow-lists"]',1,'Zero trust verifies identity, device posture and authorisation on every request regardless of network position.'),
('expert','mcq','What does a hardware security module (HSM) fundamentally provide?','["Faster disk I/O","Tamper-resistant key generation, storage and cryptographic operations","Automatic patch management","A backup power supply"]',1,'HSMs keep private keys inside tamper-resistant hardware so keys never exist in plaintext on the host.'),
('expert','mcq','Which is the correct order of the incident response lifecycle?','["Preparation, detection and analysis, containment/eradication/recovery, post-incident activity","Detection, preparation, recovery, containment","Containment, preparation, detection, review","Recovery, detection, containment, preparation"]',0,'NIST SP 800-61 defines preparation, detection and analysis, containment/eradication/recovery, then lessons learned.'),
('expert','mcq','A CVSS base score of 9.8 with network attack vector and no privileges required implies what?','["A low-risk informational finding","A critical, remotely exploitable vulnerability needing urgent remediation","A configuration warning only","An issue exploitable only with physical access"]',1,'Network vector plus no privileges and critical score means it should be prioritised for immediate patching.'),
('expert','mcq','Why is salting essential when hashing stored passwords?','["It shortens the hash","It defeats precomputed rainbow-table attacks","It makes hashing reversible","It compresses the database"]',1,'A unique salt per password means identical passwords hash differently and precomputed tables are useless.'),
('expert','mcq','Which technique best detects data exfiltration over DNS?','["Blocking all outbound port 80","Analysing DNS query entropy, volume and subdomain length anomalies","Rotating internal IP addresses","Enabling browser private mode"]',1,'DNS tunnelling shows abnormal query length, entropy and frequency patterns detectable through analytics.'),
('expert','mcq','What is the main security risk of an over-permissive cloud IAM wildcard policy?','["Increased storage cost","Privilege escalation and unrestricted blast radius on credential compromise","Slower API responses","Reduced logging fidelity"]',1,'Wildcards grant far more than needed, so any compromised principal can escalate and reach unrelated resources.'),
('expert','scenario','Ransomware has encrypted a file server. Backups exist but were mounted to the same domain. What is the highest-priority first action?','["Pay the ransom to restore quickly","Isolate affected systems and verify backup integrity from an offline copy","Reboot every server","Delete the encrypted files"]',1,'Containment comes first, and domain-joined backups may also be encrypted, so integrity must be verified offline.'),
('expert','scenario','A penetration test finds SQL injection in an internal reporting tool with no internet exposure. How should it be rated?','["Ignore it because it is internal","Treat it as a real risk since insiders and compromised hosts can reach it","Rate it informational only","Defer until the next major release"]',1,'Internal-only is not a control. Assume perimeter compromise and remediate injection flaws regardless of exposure.'),
('expert','practical','You must design secure secrets handling for a CI/CD pipeline. Which approach is strongest?','["Commit encrypted secrets to the repository","Use a managed secrets store with short-lived, scoped tokens injected at runtime","Store secrets in build logs for traceability","Share one long-lived token across all pipelines"]',1,'Short-lived, scoped credentials from a managed store minimise exposure window and allow rapid revocation.'),
('expert','practical','Design a logging strategy for an incident-ready system. Which is most important?','["Log everything at debug level indefinitely","Capture tamper-evident, time-synchronised logs shipped off-host with defined retention","Store logs only on the affected host","Disable logging in production for performance"]',1,'Off-host, time-synchronised and tamper-evident logs survive host compromise and support reliable reconstruction.'),
('expert','practical','Which approach best hardens a public API against credential-stuffing?','["Rate limiting plus anomaly detection, MFA and breached-password screening","Longer session cookies","Removing the login endpoint from documentation","Increasing server memory"]',0,'Layered controls raise attacker cost; obscurity and capacity alone do not stop automated credential replay.'),
('expert','mcq','What does "defence in depth" mean in practice?','["Deploying one very strong control","Layering independent controls so a single failure does not cause a breach","Relying only on perimeter firewalls","Encrypting only the database"]',1,'Multiple independent layers ensure one bypassed control does not expose the whole system.')
) AS v(level, kind, prompt, options, correct_index, explanation)
WHERE s.slug = 'cybersecurity';

-- ============ SEED: QUESTIONS — PYTHON (beginner) ============
INSERT INTO public.questions (skill_id, level, kind, prompt, options, correct_index, explanation, status, source)
SELECT s.id, v.level, v.kind, v.prompt, v.options::jsonb, v.correct_index, v.explanation, 'published', 'manual'
FROM public.skills s, (VALUES
('beginner','mcq','What is the output type of `len("LUA")`?','["str","int","list","tuple"]',1,'`len()` always returns an integer count of items.'),
('beginner','mcq','Which data structure is immutable in Python?','["list","dict","tuple","set"]',2,'Tuples cannot be modified after creation; lists, dicts and sets are mutable.'),
('beginner','mcq','What does a list comprehension `[x*2 for x in range(3)]` produce?','["[0, 2, 4]","[2, 4, 6]","[0, 1, 2]","[1, 2, 3]"]',0,'range(3) yields 0, 1, 2 and each is doubled, giving [0, 2, 4].'),
('beginner','mcq','How do you handle a runtime error gracefully in Python?','["with/as","try/except","for/else","def/return"]',1,'A try/except block catches exceptions so the program can recover or report cleanly.'),
('beginner','mcq','Which keyword defines a function?','["func","def","function","lambda"]',1,'`def` declares a named function; `lambda` creates a small anonymous one.'),
('beginner','scenario','Your script must read a file and always close it, even if an error occurs. What is the idiomatic approach?','["Call close() at the end","Use a `with open(...)` context manager","Wrap everything in a while loop","Rely on the garbage collector"]',1,'A context manager guarantees the file is closed when the block exits, error or not.')
) AS v(level, kind, prompt, options, correct_index, explanation)
WHERE s.slug = 'python-programming';

-- ============ SEED: QUESTIONS — PYTHON (expert) ============
INSERT INTO public.questions (skill_id, level, kind, prompt, options, correct_index, explanation, status, source)
SELECT s.id, v.level, v.kind, v.prompt, v.options::jsonb, v.correct_index, v.explanation, 'published', 'manual'
FROM public.skills s, (VALUES
('expert','mcq','What does the Global Interpreter Lock (GIL) prevent in CPython?','["Any form of concurrency","Two threads executing Python bytecode simultaneously","Use of multiprocessing","Garbage collection"]',1,'The GIL serialises bytecode execution across threads; multiprocessing sidesteps it with separate interpreters.'),
('expert','mcq','What is the key difference between `__new__` and `__init__`?','["`__new__` creates the instance, `__init__` initialises it","They are identical","`__init__` runs first","`__new__` only works on functions"]',0,'`__new__` allocates and returns the instance; `__init__` then configures the already-created object.'),
('expert','mcq','Why can a mutable default argument be a bug?','["It is a syntax error","The default object is created once and shared across all calls","It slows down imports","It disables type hints"]',1,'Defaults are evaluated at definition time, so a mutable default accumulates state between calls.'),
('expert','mcq','What does a generator provide over returning a list?','["Faster sorting","Lazy evaluation with constant memory for large sequences","Automatic parallelism","Type safety"]',1,'Generators yield items on demand, avoiding materialising the full sequence in memory.'),
('expert','mcq','Which statement about `asyncio` is correct?','["It runs CPU-bound code in parallel","It provides cooperative concurrency best suited to I/O-bound work","It replaces the GIL","It requires multiple processes"]',1,'asyncio interleaves awaits on a single thread, which helps I/O-bound but not CPU-bound workloads.'),
('expert','mcq','What does `functools.lru_cache` do?','["Limits recursion depth","Memoises function results keyed by arguments","Compresses return values","Profiles execution time"]',1,'It caches results for repeated argument sets, trading memory for speed on pure functions.'),
('expert','mcq','How does Python resolve method lookup in multiple inheritance?','["Alphabetically","Via the C3 linearisation MRO","Randomly","Depth-first right to left"]',1,'Python uses C3 linearisation to build a deterministic method resolution order.'),
('expert','mcq','What is the purpose of `__slots__`?','["Enforce type hints","Reduce per-instance memory by avoiding a per-object __dict__","Enable multithreading","Make a class immutable"]',1,'Declaring __slots__ replaces the instance dict with fixed descriptors, cutting memory for many instances.'),
('expert','mcq','Which comparison of `is` and `==` is accurate?','["`is` compares identity, `==` compares value","They are interchangeable","`is` compares value, `==` compares identity","`==` only works on numbers"]',0,'`is` checks whether two names reference the same object; `==` invokes __eq__ for value equality.'),
('expert','mcq','What does a context manager''s `__exit__` returning True do?','["Re-raises the exception","Suppresses the exception","Closes the interpreter","Restarts the block"]',1,'Returning a truthy value from __exit__ tells Python the exception was handled and should be swallowed.'),
('expert','scenario','A data pipeline reads a 40 GB CSV and runs out of memory. What is the best fix?','["Buy more RAM only","Stream the file in chunks with a generator or chunked reader","Convert it to JSON first","Load it into a list of dicts"]',1,'Chunked streaming keeps memory bounded regardless of file size.'),
('expert','scenario','Two threads increment a shared counter and the total is wrong. What is the cause and fix?','["A race condition; guard the update with a lock or use an atomic queue","A syntax error; add semicolons","Too few threads; add more","The GIL makes this impossible"]',0,'Increment is not atomic at the bytecode level, so concurrent updates interleave and lose writes.'),
('expert','practical','You must ship a library used by many teams. Which versioning and typing practice is strongest?','["No version pin and no type hints","Semantic versioning with public type hints and a documented deprecation policy","Pin every dependency to an exact patch forever","Ship only compiled bytecode"]',1,'SemVer plus type hints and clear deprecations lets consumers upgrade safely and tooling verify usage.'),
('expert','practical','Which approach best isolates a Python service''s dependencies in production?','["Install globally with sudo","Use a virtual environment or container image with a locked dependency file","Vendor packages by copying source folders","Rely on the system package manager"]',1,'Locked environments make builds reproducible and prevent cross-project dependency conflicts.'),
('expert','practical','Your test suite is slow and flaky due to network calls. What is the best remedy?','["Increase timeouts","Mock external boundaries and keep a small separate integration suite","Delete the failing tests","Run tests only before release"]',1,'Isolating unit tests from the network makes them fast and deterministic while integration tests cover real wiring.'),
('expert','mcq','What does `yield from` do inside a generator?','["Ends the generator","Delegates iteration and value passing to a sub-generator","Converts to a list","Starts a thread"]',1,'`yield from` delegates to another iterable, forwarding sent values and exceptions transparently.')
) AS v(level, kind, prompt, options, correct_index, explanation)
WHERE s.slug = 'python-programming';

-- ============ SEED: QUESTIONS — CLOUD (beginner) ============
INSERT INTO public.questions (skill_id, level, kind, prompt, options, correct_index, explanation, status, source)
SELECT s.id, v.level, v.kind, v.prompt, v.options::jsonb, v.correct_index, v.explanation, 'published', 'manual'
FROM public.skills s, (VALUES
('beginner','mcq','What does IaaS stand for?','["Internet as a Service","Infrastructure as a Service","Integration as a Service","Identity as a Service"]',1,'IaaS provides raw compute, storage and networking that you manage yourself.'),
('beginner','mcq','Which is the main benefit of cloud elasticity?','["Fixed monthly cost","Capacity scales up and down with demand","Unlimited free storage","No need for backups"]',1,'Elasticity matches provisioned capacity to actual load, avoiding both over- and under-provisioning.'),
('beginner','mcq','What is an availability zone?','["A billing account","An isolated datacentre location within a region","A DNS record","A type of load balancer"]',1,'Availability zones are physically separate facilities within a region used for fault isolation.'),
('beginner','mcq','Object storage is best suited for what?','["Running a relational database","Storing large unstructured files like images and backups","Low-latency block I/O for a VM boot disk","Executing containers"]',1,'Object storage is optimised for durable, cheap storage of unstructured blobs accessed over HTTP.'),
('beginner','mcq','In the shared responsibility model, who secures the data you upload?','["The cloud provider only","The customer","No one","The internet service provider"]',1,'Providers secure the cloud itself; customers secure their data, identities and configurations in it.'),
('beginner','scenario','Your web app has traffic spikes every evening. What is the simplest cloud-native fix?','["Buy a bigger server permanently","Enable autoscaling behind a load balancer","Turn the app off overnight","Move to a single fixed VM"]',1,'Autoscaling adds instances during peaks and removes them afterwards, matching cost to demand.')
) AS v(level, kind, prompt, options, correct_index, explanation)
WHERE s.slug = 'cloud-computing';

-- ============ SEED: QUESTIONS — CLOUD (expert) ============
INSERT INTO public.questions (skill_id, level, kind, prompt, options, correct_index, explanation, status, source)
SELECT s.id, v.level, v.kind, v.prompt, v.options::jsonb, v.correct_index, v.explanation, 'published', 'manual'
FROM public.skills s, (VALUES
('expert','mcq','What does an RPO of 15 minutes specify?','["Maximum tolerable data loss window","Maximum downtime allowed","Time to detect an incident","Backup retention period"]',0,'Recovery Point Objective bounds acceptable data loss; RTO bounds acceptable downtime.'),
('expert','mcq','Which pattern best prevents cascading failure between microservices?','["Retry forever with no backoff","Circuit breaker with timeouts and exponential backoff","Synchronous chained calls","A shared database for all services"]',1,'Circuit breakers fail fast and shed load instead of amplifying pressure on a struggling dependency.'),
('expert','mcq','What is the main reason to use infrastructure as code?','["It is cheaper to run","Reproducible, reviewable and version-controlled environments","It removes the need for monitoring","It eliminates cloud costs"]',1,'IaC makes environments deterministic and auditable, and enables safe rollback and peer review.'),
('expert','mcq','When is a multi-region active-active design most justified?','["For any small internal tool","When strict low latency and regional failure tolerance are required","To reduce complexity","To avoid using load balancers"]',1,'Active-active adds significant complexity and cost, justified by strict availability and latency requirements.'),
('expert','mcq','Which storage class choice best controls cost for rarely accessed backups?','["Standard hot storage","Archive or cold tier with lifecycle transition rules","In-memory cache","Local SSD"]',1,'Lifecycle policies move ageing objects to colder tiers where storage cost drops sharply.'),
('expert','mcq','What is the principal risk of long-lived static cloud access keys?','["Slower API calls","They cannot be revoked quickly enough when leaked","Higher storage cost","Reduced region availability"]',1,'Long-lived keys have an unbounded exposure window; short-lived role-based credentials are preferred.'),
('expert','mcq','Which metric best indicates an autoscaling group is misconfigured?','["High CPU with no scale-out events during sustained load","Low disk usage","Even request distribution","Stable memory usage"]',0,'If load is sustained and no scale-out occurs, thresholds, cooldowns or limits are wrong.'),
('expert','mcq','What does eventual consistency mean for a distributed data store?','["Writes are never durable","Reads may briefly return stale data before converging","Reads always fail during writes","Data is only consistent at midnight"]',1,'Replicas converge over time, so a read shortly after a write may see an older value.'),
('expert','mcq','Why place a CDN in front of an application?','["To replace the database","To cache content near users, reducing latency and origin load","To encrypt the database at rest","To generate SSL certificates"]',1,'Edge caching cuts round-trip latency and offloads a large share of requests from the origin.'),
('expert','mcq','Which practice most improves cloud cost visibility across teams?','["A single shared untagged account","Consistent resource tagging with per-team cost allocation and budgets","Disabling billing alerts","Monthly manual spreadsheets only"]',1,'Tagging plus allocation and budgets attributes spend to owners and enables timely intervention.'),
('expert','scenario','A nightly batch job saturates the production database. What is the best architectural fix?','["Run it more often","Route it to a read replica or a separate analytics store","Increase the app server count","Disable indexes"]',1,'Isolating analytical load from the transactional primary protects production latency.'),
('expert','scenario','A region-wide outage takes your single-region service offline. What should the post-incident change be?','["Nothing, outages are rare","Introduce cross-region backups and a tested failover runbook","Add more instances in the same region","Turn off health checks"]',1,'Single-region designs need cross-region recovery capability and rehearsed failover to be credible.'),
('expert','practical','Design a zero-downtime deployment strategy. Which fits best?','["Stop all servers, deploy, restart","Blue-green or canary rollout with automated health checks and rollback","Deploy directly to production on Friday evening","Manual FTP upload"]',1,'Blue-green and canary shift traffic gradually with automated verification and fast rollback.'),
('expert','practical','What is the strongest way to secure service-to-service traffic inside a cluster?','["Allow all internal traffic","Mutual TLS with workload identities and network policies","Only a perimeter firewall","IP allow-lists managed by hand"]',1,'mTLS with workload identity authenticates both ends and network policy restricts reachability.'),
('expert','practical','Your observability is limited to CPU graphs. What should you add first?','["More CPU graphs","Structured logs, distributed tracing and SLO-based alerting on user-facing metrics","Only uptime pings","Screenshot-based monitoring"]',1,'User-facing SLOs plus traces and structured logs explain why requests fail, not just that a host is busy.'),
('expert','mcq','What is the main trade-off of serverless functions?','["No scaling","Operational simplicity in exchange for cold starts, runtime limits and vendor coupling","Higher fixed cost always","No logging support"]',1,'Serverless removes server management but introduces cold-start latency, execution limits and portability constraints.')
) AS v(level, kind, prompt, options, correct_index, explanation)
WHERE s.slug = 'cloud-computing';

-- ============================================================
-- 20260730075619_10013112-4622-4dea-baa4-1c5dda29b45b.sql
-- ============================================================
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- 20260811120000_9f3c7a21-5e6b-4d8a-b1c4-2a7e9f0d3c56.sql
-- ============================================================
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


-- ============================================================
-- 20260811130000_3c8e6f12-7a4d-4b91-9e2a-1f5d8c0b6e34.sql
-- ============================================================
-- ============ ADMIN AUDIT LOG ============
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);
GRANT SELECT, INSERT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit log" ON public.admin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write audit log" ON public.admin_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND actor_id = auth.uid());

-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read all tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update all tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ SUPPORT TICKET MESSAGES ============
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_ticket_messages_ticket_idx ON public.support_ticket_messages (ticket_id, created_at);
GRANT SELECT, INSERT ON public.support_ticket_messages TO authenticated;
GRANT ALL ON public.support_ticket_messages TO service_role;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read messages on their own tickets" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Users write messages on their own tickets" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
  );
CREATE POLICY "Admins read all ticket messages" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins write any ticket messages" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());


-- ============================================================
-- 20260813090000_6d2b9e47-1a3c-4f8e-9b5d-7c1a4f2e8b93.sql
-- ============================================================
-- ============ ADMIN NOTIFICATIONS ============
-- System-generated alerts for admins (new certificate upload, new support ticket, etc).
-- Written only by server-side logic using the service-role client — no client-side INSERT
-- policy is granted, so notifications can't be forged by a regular authenticated user.
CREATE TABLE public.admin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  target_type text,
  target_id text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_notifications_created_idx ON public.admin_notifications (created_at DESC);
GRANT SELECT, UPDATE ON public.admin_notifications TO authenticated;
GRANT ALL ON public.admin_notifications TO service_role;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notifications" ON public.admin_notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update notifications" ON public.admin_notifications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- 20260813100000_2f7a5c81-8e3d-4b6f-a1c9-5d0e2b7f4a16.sql
-- ============================================================
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


