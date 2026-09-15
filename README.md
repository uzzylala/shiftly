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
- A running PostgreSQL instance

## Setup

```bash
npm run setup            # npm install + builds the shared package once
cp backend/.env.example backend/.env
# edit backend/.env with your real DATABASE_URL and JWT secrets

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

- [x] **Phase 1 — MVP**: single-role (manager) schedule CRUD. Manager logs
      in, maintains an employee roster, and creates/edits/deletes shifts.
      No drag-and-drop yet, no employee/HR logins yet, no conflict
      detection yet — all deliberately deferred to later phases.
- [ ] Phase 2 — RBAC (CASL-based permission layer) + availability
      submission + double-booking/conflict detection
- [ ] Phase 3 — Drag-and-drop calendar with a full keyboard alternative
- [ ] Phase 4 — Shift-swap approval workflow (XState state machine) +
      real-time notifications (SSE)
- [ ] Phase 5 — Production polish

## Known issues

- `npm audit` reports high-severity advisories in `deepmerge-ts` and
  `mysql2`, both transitive dependencies of the Prisma CLI itself (a
  devDependency). Neither is reachable through anything this app does at
  runtime (we don't use MySQL, and the vulnerable config-merge path isn't
  fed attacker-controlled input); tracked upstream in Prisma's dependency
  tree, not fixable from this project.
