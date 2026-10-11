# Chronokid: Era Hopper

Chronokid is a browser-based canvas platformer. The repository is being organized as a small TypeScript monorepo so the game client and its backend can evolve independently.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- Docker Desktop (or another Docker Compose-compatible runtime) for local PostgreSQL

## Local development

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` (the defaults are for local development).
3. Start PostgreSQL: `npm run db:up`
4. Apply database migrations: `npm run db:migrate`
5. Start the web client and API: `npm run dev`

The Vite client is at `http://localhost:5173`; the API is at `http://localhost:3001`. Check API liveness at `/api/health` and database readiness at `/api/health/ready`.

Stop PostgreSQL with `npm run db:down`. The existing root `index.html` remains the original playable prototype; Phase 2 will migrate its game into `apps/web`.

## Workspace

- `apps/web`: Vite + TypeScript client shell, with `/api` proxied to the API in development.
- `apps/api`: Fastify API, Drizzle schema/migrations, PostgreSQL connection.
- `packages/shared`: Types shared between the browser and API.

The current API only exposes health and readiness endpoints. Player identity, run persistence, scores, and leaderboard routes belong to later phases.

## Project guardrails

See [PLAN.md](PLAN.md) for current phase status, decisions, risks, and resume instructions. Repository-specific coding and security instructions are in `.github/copilot-instructions.md` and `.github/instructions/api-security.instructions.md`. Use the `Chronokid Review` agent in `.github/agents/chronokid-review.agent.md` for read-only, findings-first code reviews.