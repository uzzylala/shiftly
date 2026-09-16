# Shiftly

Team scheduling and shift-management platform. Manager, Employee, and HR
roles interact with the same schedule data through genuinely different
permission-gated UIs and workflows.

Built in phases; see the phase status below for what currently exists.

## Stack

- **Frontend**: React + TypeScript, Vite, Tailwind CSS v4, React Router,
  TanStack Query, React Hook Form + Zod, Zustand
- **Backend**: Node.js + Express, JWT auth (access + refresh tokens),
  Prisma ORM v7 (driver adapter: `@prisma/adapter-pg`)
- **Database**: PostgreSQL
- **Monorepo**: npm workspaces (`shared/`, `backend/`, `frontend/`)

`shared/` holds types and Zod schemas imported by both apps, so API
contracts and validation rules can't silently drift between client and
server.

## Prerequisites

- Node.js 20+
- A PostgreSQL instance (a free [Neon](https://neon.tech) database works well)
- A Redis instance (a free [Upstash](https://upstash.com) database works well —
  use its **ioredis / TCP** connection string, the one starting `rediss://`,
  not the REST URL). Backs the real-time notification stream; see
  `backend/src/services/sse.service.ts`.

## Setup

```bash
npm run setup            # npm install + builds the shared package once
cp backend/.env.example backend/.env
# edit backend/.env with your real DATABASE_URL, REDIS_URL, and JWT secrets

npm run prisma:migrate -w backend   # creates tables
npm run seed -w backend             # seeds one manager: manager@shiftly.dev / password123

npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:5173 (proxies /api to the backend)
```

`shared/` is compiled to `shared/dist` and consumed from there (not
transpiled live), so if you edit `shared/src`, re-run `npm run build:shared`
(or `npm run dev:backend` / `npm run dev:frontend`, which do this for you)
before the change shows up in the other packages.

## Phase status

- [] **Phase 1 — MVP**: single-role (manager) schedule CRUD. Manager logs
  in, maintains an employee roster, and creates/edits/deletes shifts.
  No drag-and-drop yet, no employee/HR logins yet, no conflict
  detection yet — all deliberately deferred to later phases.
- [ ] Phase 2 — RBAC (CASL-based permission layer) + availability
      submission + double-booking/conflict detection
- [ ] Phase 3 — Drag-and-drop calendar with a full keyboard alternative
- [ ] Phase 4 — Shift-swap approval workflow (XState state machine) +
      real-time notifications (SSE)
- [ ] Phase 5 — Production polish

## Deploying to Vercel

The whole app (static frontend + API) deploys as a single Vercel project:
the frontend builds to static files, the Express backend runs as one
serverless function (`api/index.mjs`) that Vercel routes all `/api/*`
requests to via `vercel.json`'s rewrites — same origin, no CORS involved in
production.

Two things had to change for the backend to work as a serverless function
rather than a long-running process:

- **Prisma client** (`backend/src/prisma.ts`) is cached on `globalThis` so a
  warm function invocation reuses the existing connection pool instead of
  opening a new one every time.
- **Real-time notifications** (`backend/src/services/sse.service.ts`) no
  longer use an in-memory connection/ticket registry — that only works on a
  single long-running process, and serverless functions are stateless and
  multi-instance. Tickets and the cross-instance push now go through Redis
  (ticket storage + pub/sub) instead. Each SSE stream also closes itself
  after 50 seconds on its own terms (`STREAM_LIFETIME_MS` in
  `events.routes.ts`) rather than waiting to be killed mid-write by the
  platform's execution limit — the client's existing reconnect-with-a-fresh-
  ticket logic (`frontend/src/lib/sse.ts`) already handles this the same way
  it handles any other stream drop.

### One-time setup

1. **Database**: a Neon (or other) Postgres instance, migrated and seeded
   (see Setup above).
2. **Redis**: an Upstash Redis database — either via the
   [Upstash Vercel integration](https://vercel.com/integrations/upstash)
   (auto-injects the env var into your Vercel project) or created directly
   at upstash.com and added manually. Either way, use the **TCP**
   (`rediss://...`) connection string, not the REST URL.
3. In the Vercel project's Environment Variables, set: `DATABASE_URL`,
   `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, and optionally
   `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL`. `CORS_ORIGIN` isn't needed in
   production (same-origin), but the app still reads it as a fallback for
   local dev.
4. Import the repo into Vercel — `vercel.json` at the repo root already
   defines the build command, output directory, and rewrites, so the
   default "Other" framework preset with no further configuration is
   correct.
5. If you're on the Hobby plan, note the 60s `maxDuration` set on the
   function in `vercel.json` — that's the platform's Hobby-tier ceiling; a
   Pro plan can raise it (up to 300s) if you want longer-lived streams
   before a reconnect.
