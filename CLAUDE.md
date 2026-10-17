# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

LUA (Lily Upskilling Academy) — a skill-verification platform (practical assessments, AI evaluation, employer-facing certificate verification). Built with **TanStack Start** (React 19 + Vite + file-based routing), not Next.js. The project was scaffolded in **Lovable** (lovable.dev), but on this branch every Lovable dependency is gone: it's a self-hosted app (Node.js + PostgreSQL + Groq). `main` is still connected to Lovable; don't push this branch there.

`README.md` is a short overview. `HOSTING.md` has the setup and hosting steps for end users. `docs/` (HTML/PDF) describes the earlier Supabase + Lovable architecture and is out of date.

## Commands

Package manager is **bun** (`bunfig.toml`, `bun.lock`); a `package-lock.json` also exists but bun is primary.

```sh
bun install        # or: npm i
bun run dev        # vite dev server
bun run build      # vite build (nitro/cloudflare target)
bun run build:dev  # build in development mode
bun run preview    # preview a production build
bun run lint       # eslint .
bun run format     # prettier --write .
bun run start      # run the production build (.output/server/index.mjs) with .env
bun run db:setup   # create the PostgreSQL database + apply db/bootstrap.sql and supabase/migrations/
bun run db:create-user -- <email> <password> [--admin] [--name "Full Name"]
bun run db:import-supabase [-- --dry-run]  # one-time copy of a Supabase project's data (needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
```

`vitest` is installed with a `test` script, but there are no tests yet.

**Local PostgreSQL, not Supabase (branch `local-postgres`).** The app runs against a plain PostgreSQL database (`DATABASE_URL`). Supabase is no longer used, and `@supabase/supabase-js` isn't a dependency. `HOSTING.md` has the end-user setup steps.

`bunfig.toml` enforces a 24h supply-chain guard (`minimumReleaseAge`) on new dependency versions; nothing bypasses it. Confirm with the user before adding a `minimumReleaseAgeExcludes` entry.

## Architecture

### Routing

File-based routing via TanStack Router — see `src/routes/README.md` for the naming rules (bare `$id` for dynamic segments, `_layout` for layout routes, `__root.tsx` as the app shell). `src/routeTree.gen.ts` is generated; never hand-edit it. `src/routes/_authenticated/` is a pathless layout (`route.tsx`) whose `beforeLoad` calls `supabase.auth.getUser()` and redirects to `/auth` when unauthenticated — every route nested under it inherits that guard, runs with `ssr: false`, and gets `{ user }` in route context.

### Server functions: the `-shared` / `.functions` / `.server` split

Server-backed features (`src/lib/admin*`, `src/lib/assessment*`) are split into three files per feature:

- `*-shared.ts` — plain types/constants safe on both client and server (e.g. `assessment-shared.ts`, `admin-shared.ts`).
- `*.functions.ts` — `createServerFn(...)` definitions (TanStack Start RPCs). These ship to the client bundle as thin stubs, so they must not import server-only secrets directly.
- `*.server.ts` — the actual server-only logic (service-role queries, calls to Groq, `assertAdmin`). Loaded only from within a `.functions.ts` handler, generally via a dynamic `await import(...)` (see `admin()` in `assessment.server.ts`).

ESLint enforces the naming convention: importing the Next.js-style `server-only` package is banned (`eslint.config.js`), and modules meant to be server-only should be suffixed `*.server.ts` (or use `@tanstack/react-start/server-only`) instead. Route files and `*.functions.ts` are part of the client bundle — never put secrets or `SUPABASE_SERVICE_ROLE_KEY` usage there directly.

### Database + auth plumbing (Supabase compatibility layer)

The code was written against supabase-js. Instead of rewriting ~40 files, `src/integrations/supabase/` keeps the same exports (`supabase`, `supabaseAdmin`, `requireSupabaseAuth`), now backed by local PostgreSQL.

- `src/lib/db/query-builder.ts`: an isomorphic, supabase-js-compatible builder (`from().select().eq().order().limit().single()`, `insert/update/upsert/delete`, `rpc`). It only builds a serialisable `QuerySpec`. It implements just the subset the app uses; add any new supabase-js method there before using it.
- `src/lib/db/sql.server.ts`: compiles a `QuerySpec` to SQL, mirroring PostgREST. It resolves embedded relations like `skills(name)` through foreign keys read from `pg_catalog`, sends JSON values to json/jsonb columns, and returns errors as `{ data: null, error }` instead of throwing.
- `src/lib/db/pg.server.ts`: the `pg` pool and `withRole()`. `service` runs as the DB owner and bypasses RLS. `user` runs `SET LOCAL ROLE authenticated` with `request.jwt.claim.sub = userId`, so `auth.uid()` and the RLS policies work unchanged. `anon` runs as the `anon` role.
- `db/bootstrap.sql`: recreates what the Supabase migrations expect: the `anon`/`authenticated`/`service_role` roles, `auth.users`, `auth.uid()`, `storage.buckets/objects`, `storage.foldername()`. It also adds `auth.sessions`, `auth.password_reset_tokens` and `app_meta.applied_migrations`. **New migrations still go in `supabase/migrations/`**; `scripts/db-setup.mjs` applies them in filename order.

Entry points, each with a specific purpose:

- `src/integrations/supabase/client.ts` (`supabase`): the browser/SSR client. `.from()` and `.rpc()` call the `runClientQuery` / `runClientRpc` server functions (`src/lib/db/client-query.functions.ts`). Those run as `authenticated` (signed in) or `anon`, never as the owner, so table GRANTs and RLS decide access, the same as with PostgREST. `.auth.*` calls the auth server functions, and `.storage.from(b).upload()` POSTs to `/api/storage/upload/...`.
- `src/integrations/supabase/client.server.ts` (`supabaseAdmin`): the owner-role client that bypasses RLS, plus `.auth.admin` (listUsers / getUserById / updateUserById for bans) and `.storage`. Server-only. Import it lazily inside server handlers.
- `src/integrations/supabase/auth-middleware.ts` (`requireSupabaseAuth`): resolves the session cookie and injects `context.{ supabase, userId, claims }`, where `context.supabase` is a `user`-role (RLS-scoped) client.

Auth is email + password only (`src/lib/auth/`). Passwords are hashed with scrypt (`password.server.ts`). Sessions are random tokens stored hashed in `auth.sessions`, behind an httpOnly `lua_session` cookie. The cookie is sent automatically, so there's no client-side token-attaching middleware anymore. Sign-up signs the user in immediately; there's no email confirmation. Password-reset links are emailed through SMTP (`mail.server.ts`), or printed to the server console when `SMTP_HOST` isn't set. Banning sets `auth.users.banned_until` and deletes the user's sessions.

Admin authorization is unchanged. `assertAdmin()` (`admin.server.ts`) calls the `has_role(_user_id, 'admin')` SECURITY DEFINER function through the user's own RLS-scoped client.

File storage (`src/lib/storage/storage.server.ts`): object metadata goes in `storage.objects`, so the storage RLS policies still apply. The bytes go on disk under `LOCAL_STORAGE_DIR` (default `./.local-storage`). Downloads go through short-lived HMAC-signed URLs served by `src/routes/api.storage.$.tsx`.

### Layered error handling

Errors are caught at three levels, each guarding against a different failure mode:

1. `src/start.ts` — `errorMiddleware` wraps every request-level TanStack Start handler; rethrows anything with a `statusCode` (i.e. an intentional HTTP error), otherwise logs and returns a static error page.
2. `src/server.ts` — wraps the whole SSR `fetch` entrypoint. It also detects the case where h3 (Nitro's HTTP layer) has swallowed an in-handler throw into a generic `{"unhandled":true,"message":"HTTPError"}` 500 response that a `try/catch` here can't see directly (`normalizeCatastrophicSsrResponse`).
3. `src/lib/error-capture.ts` — a global `error`/`unhandledrejection` listener that stashes the last thrown error for ~5s, so `server.ts` can recover the real stack trace even after h3 has swallowed it.

`src/lib/error-page.ts` renders the static (no-JS, no-dependency) fallback HTML shown when SSR itself has failed.

### AI features (Groq)

Every AI feature uses Groq with a single key, `BUSTLER_GROQ_API_KEY`. The model, base URL and timeouts come from `createEngineConfig()` (`src/lib/interview-engine/config.ts`).

- The AI Interview uses `src/lib/interview-engine/` (GroqClient, prompts, scoring).
- The two MCQ-side features call `completeJson()` (`src/lib/ai.server.ts`), which reuses the same `GroqClient`. JSON is requested **in the prompt** and parsed with `parseJsonObject`, not via `response_format`, because strict JSON mode fails on Groq's gpt-oss models (see `GroqClient.body()`). The output is then validated defensively:

- `admin.server.ts::generateQuestionsWithAi` — generates draft MCQ questions for the admin question bank, avoiding duplicates of existing prompts.
- `assessment.server.ts::evaluateWithAi` — produces qualitative feedback (summary/strengths/gaps/recommendation) after an attempt is graded; **never throws** — falls back to a templated summary if the key is missing, Groq errors, or the response doesn't parse.

### Data model (PostgreSQL, `supabase/migrations/`)

RLS is enabled on every table. Key shape:

- `app_role` enum: `candidate | employer | reviewer | admin`. `user_roles` + `has_role(user_id, role)` (SECURITY DEFINER) is the only sanctioned way to check roles from RLS policies or `assertAdmin`.
- `profiles` — auto-created via `handle_new_user()` trigger on `auth.users` insert.
- `skills` — the skill catalog (publicly readable when `is_active`).
- `questions` — question bank; `level` (`beginner`/`expert`), `status` (`draft`/`published`/`archived`), `source` (`manual`/`ai`). Only `admin`/`reviewer` roles can read it directly (candidates only ever see questions via the attempt server functions, which use the service-role client to avoid leaking answers through RLS).
- `assessment_attempts` — one row per attempt; `question_ids` is a fixed drawn set, `answers`/`ai_feedback` are jsonb, graded server-side only.
- `certificates` — issued on a passed **expert**-level attempt; publicly readable when `is_public` (powers the `/verify/$id` employer-verification page).

Assessment level config (question count, duration, pass mark) is centralized in `LEVEL_CONFIG` (`src/lib/assessment-shared.ts`): beginner = 5Q/10min/60% pass, expert = 15Q/30min/70% pass. Passing an **expert** attempt is what mints a certificate row and marks the skill `verified`.

### Skills dashboard and public verify page are live data

`src/routes/_authenticated/skills.tsx` (candidate Skills dashboard) is fully live against the database via `listMySkills` / `listSkillCatalog` / `addMySkill` / `removeMySkill` (`skills.functions.ts`). `src/routes/verify.$id.tsx` and `src/routes/certificates.$id.tsx` (public employer-facing pages) query the real `certificates` table directly (`status = 'approved'`, `is_public = true`). `src/lib/skills.ts` only holds unrelated career-recommendation fixture data (`RECOMMENDATIONS`) now; `src/lib/certificates.ts` no longer exists.

### Styling

Tailwind CSS v4, configured CSS-first in `src/styles.css` (no `tailwind.config.js` — theme tokens live under `@theme inline` and `:root`/`.dark`). shadcn/ui components (`components.json`: style `new-york`, base color `slate`, no class prefix) live in `src/components/ui/`. Icons: `lucide-react`. Animation: the `motion` package (Framer Motion's new package name) — import from `"motion/react"`.

Path alias: `@/*` → `src/*` (see `tsconfig.json` / `components.json`).

### Vite config

`vite.config.ts` is a plain Vite config: `tailwindcss`, `tsConfigPaths`, `tanstackStart` (server entry → `src/server.ts`, with import protection that fails the build if client code imports `**/server/**` or `server-only`), nitro (build only, preset `node-server`), then `viteReact`. Keep `tanstackStart` before `viteReact`. Nitro targets Node because Cloudflare Workers can't open TCP connections to PostgreSQL or write files to disk. Deploy by running `npm run build` and then `npm start`.

`src/start.ts` registers `createCsrfMiddleware` for server functions. Auth is a cookie, so cross-site serverFn calls are rejected with 403 based on `Sec-Fetch-Site`/`Origin`. Scripted clients must send a same-origin `Origin` header.
