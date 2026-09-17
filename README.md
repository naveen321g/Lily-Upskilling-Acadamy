# LUA — Lily Upskilling Academy

A skill-verification platform: candidates complete practical assessments, get AI evaluation, and earn employer-verifiable certificates and badges.

This is **not** a course/LMS site — it's a verification platform. Candidates prove skills through assessments and certificate uploads; admins review and issue verified credentials; employers verify credentials publicly via `/verify/:id`.

## Tech stack

- **[TanStack Start](https://tanstack.com/start)** (React 19 + Vite + file-based routing) — not Next.js
- **TypeScript**
- **[Supabase](https://supabase.com)** — Postgres, Auth, Storage, Row-Level Security
- **Tailwind CSS v4** (CSS-first config, see `src/styles.css`)
- **[shadcn/ui](https://ui.shadcn.com)** components (`src/components/ui/`)
- **[TanStack Query](https://tanstack.com/query)** for data fetching
- **[motion](https://motion.dev)** (Framer Motion's current package) for animation
- **Lucide React** icons

Routes live in `src/routes/` using TanStack Router's file-based conventions — see `src/routes/README.md` for the naming rules. `src/routeTree.gen.ts` is generated; never hand-edit it.

## Managed through Lovable

This project is connected to [Lovable](https://lovable.dev/projects/c32921b1-8793-407c-9453-0377d3390f03). Commits pushed to the connected branch sync back into the Lovable editor — keep the branch buildable, and avoid rewriting published history (no force-push/rebase/amend of pushed commits; see `AGENTS.md`).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to the connected branch and your changes sync back into Lovable.

## Development

Package manager is **bun** (`bunfig.toml`, `bun.lock`); `npm` also works via the checked-in `package-lock.json`.

```sh
bun install        # or: npm i
bun run dev        # vite dev server
bun run build      # vite build (nitro/cloudflare target)
bun run build:dev  # build in development mode
bun run preview    # preview a production build
bun run lint       # eslint .
bun run format     # prettier --write .
```

There is no test suite/framework configured in this repo currently.

See `CLAUDE.md` for a deeper guide to the codebase's architecture — server function conventions, auth plumbing, data model, and known mock-data areas.
