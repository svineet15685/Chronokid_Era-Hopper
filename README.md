# Chronokid: Era Hopper

Chronokid is a browser-based canvas platformer. The repository is being organized as a small TypeScript monorepo so the game client and its backend can evolve independently.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- PostgreSQL for local development: either Docker Desktop (or another Compose-compatible runtime), or a local PostgreSQL install (see below)

## Local development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` (the defaults are for local development).
3. Start PostgreSQL: `npm run db:up`
4. Apply database migrations: `npm run db:migrate`
5. Start the web client and API: `npm run dev`

The Vite client is at `http://localhost:5173`; the API is at `http://localhost:3001`. Check API liveness at `/api/health` and database readiness at `/api/health/ready`.

Stop PostgreSQL with `npm run db:down`. The existing root `index.html` remains the original playable prototype; Phase 2 will migrate its game into `apps/web`.

### Local database without Docker

If Docker is unavailable or port 5432 is taken by another PostgreSQL server, run a project-only cluster on port 5433 with the installed PostgreSQL binaries:

1. Create the cluster once, outside the repository, with a password you choose (kept out of source control):
   `initdb -D "%LOCALAPPDATA%\Chronokid\pgdata" -U chronokid -A scram-sha-256 -E UTF8 --pwprompt`
2. Start it: `npm run db:local:start` (stop with `npm run db:local:stop`, check with `npm run db:local:status`).
3. Create the database once: `createdb -h localhost -p 5433 -U chronokid chronokid`
4. Set `DATABASE_URL=postgres://chronokid:<password>@localhost:5433/chronokid` in the root `.env`, then run `npm run db:migrate`.

The script defaults to `C:\Program Files\PostgreSQL\18\bin` on Windows and `pg_ctl` on `PATH` elsewhere; override with `CHRONOKID_PG_BIN`, `CHRONOKID_PGDATA`, or `CHRONOKID_PG_PORT`. The cluster is not a Windows service, so start it again after a reboot.

## Workspace

- `apps/web`: Vite + TypeScript client shell, with `/api` proxied to the API in development.
- `apps/api`: Fastify API, Drizzle schema/migrations, PostgreSQL connection.
- `packages/shared`: Types shared between the browser and API.

The current API only exposes health and readiness endpoints. Player identity, run persistence, scores, and leaderboard routes belong to later phases.

## Project guardrails

See [PLAN.md](PLAN.md) for current phase status, decisions, risks, and resume instructions. Repository-specific coding and security instructions are in `.github/copilot-instructions.md` and `.github/instructions/api-security.instructions.md`. Use the `Chronokid Review` agent in `.github/agents/chronokid-review.agent.md` for read-only, findings-first code reviews.