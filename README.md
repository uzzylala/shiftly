# Shiftly

Shiftly is a team scheduling and shift-management platform for
organizations that have outgrown a shared spreadsheet. Managers build and
adjust the week's schedule, employees see only their own shifts and can
request swaps with coworkers, and HR gets a full audit trail of every
change — Manager, Employee, and HR aren't just labels, each role gets a
genuinely different permission-gated UI over the same underlying schedule
data.

**Highlights**

- **Drag-and-drop scheduling**, with a full keyboard and touch alternative —
  nothing is mouse-only.
- **Conflict detection** that checks a shift against an employee's submitted
  availability and their existing shifts before it's ever saved.
- **Shift-swap workflow** modeled as an explicit state machine (request →
  coworker accepts → manager approves → finalized) instead of ad hoc status
  checks.
- **Real-time notifications** over Server-Sent Events, so a swap request or
  approval shows up instantly for everyone involved.
- **Full audit log** of every schedule change — who, what, and the
  before/after values.

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

## Phase status

- [ ] Phase 1 — MVP: single-role (manager) schedule CRUD. Manager logs
      in, maintains an employee roster, and creates/edits/deletes shifts.
      No drag-and-drop yet, no employee/HR logins yet, no conflict
      detection yet — all deliberately deferred to later phases.
- [ ] Phase 2 — RBAC (CASL-based permission layer) + availability
      submission + double-booking/conflict detection
- [ ] Phase 3 — Drag-and-drop calendar with a full keyboard alternative
- [ ] Phase 4 — Shift-swap approval workflow (XState state machine) +
      real-time notifications (SSE)
- [ ] Phase 5 — Production polish
