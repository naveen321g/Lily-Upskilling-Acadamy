# LUA — Lily Upskilling Academy

A skill-verification platform: candidates complete practical assessments, get AI evaluation, and earn employer-verifiable certificates and badges.

This is **not** a course/LMS site — it's a verification platform. Candidates prove skills through assessments and certificate uploads; admins review and issue verified credentials; employers verify credentials publicly via `/verify/:id`.

## Tech stack

- **[TanStack Start](https://tanstack.com/start)** (React 19 + Vite + file-based routing) — not Next.js
- **TypeScript**
- **PostgreSQL** (self-hosted) — data, row-level security; app-owned email/password auth and local file storage
- **Groq** — AI question generation, assessment feedback and the AI interview
- **Tailwind CSS v4** (CSS-first config, see `src/styles.css`)
- **[shadcn/ui](https://ui.shadcn.com)** components (`src/components/ui/`)
- **[TanStack Query](https://tanstack.com/query)** for data fetching
- **[motion](https://motion.dev)** (Framer Motion's current package) for animation
- **Lucide React** icons

Routes live in `src/routes/` using TanStack Router's file-based conventions — see `src/routes/README.md` for the naming rules. `src/routeTree.gen.ts` is generated; never hand-edit it.

## Development

Package manager is **bun** (`bunfig.toml`, `bun.lock`); `npm` also works via the checked-in `package-lock.json`.

```sh
bun install        # or: npm i
bun run dev        # vite dev server
bun run build      # vite build (nitro node-server target)
bun run start      # run the production build
bun run db:setup   # create the database + apply migrations
bun run build:dev  # build in development mode
bun run preview    # preview a production build
bun run lint       # eslint .
bun run format     # prettier --write .
```

To set up and host the app (PostgreSQL, `.env`, first admin account), see **`HOSTING.md`**.

`vitest` is installed with a `test` script, but there are no tests yet.

See `CLAUDE.md` for a deeper guide to the codebase's architecture — server function conventions, auth plumbing, data model, and known mock-data areas.
