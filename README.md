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

Stop PostgreSQL with `npm run db:down`. The game runs from `apps/web`. The original single-file prototype (root `index.html`) was deleted after the migration was verified; recover it from git history (`git show ffd243e:index.html`) if needed.

### Tests

- `npm run lint`: oxlint (correctness and suspicious-pattern rules; warnings fail).
- `npm test`: Vitest behavior tests for the game simulation.
- `npm run test:e2e`: Playwright browser checks on desktop and mobile viewports. Install the browser once with `npx playwright install chromium`. They start their own Vite server on port 5174.

### Local database without Docker

If Docker is unavailable or port 5432 is taken by another PostgreSQL server, run a project-only cluster on port 5433 with the installed PostgreSQL binaries:

1. Create the cluster once, outside the repository, with a password you choose (kept out of source control):
   `initdb -D "%LOCALAPPDATA%\Chronokid\pgdata" -U chronokid -A scram-sha-256 -E UTF8 --pwprompt`
2. Start it: `npm run db:local:start` (stop with `npm run db:local:stop`, check with `npm run db:local:status`).
3. Create the database once: `createdb -h localhost -p 5433 -U chronokid chronokid`
4. Set `DATABASE_URL=postgres://chronokid:<password>@localhost:5433/chronokid` in the root `.env`, then run `npm run db:migrate`.

The script defaults to `C:\Program Files\PostgreSQL\18\bin` on Windows and `pg_ctl` on `PATH` elsewhere; override with `CHRONOKID_PG_BIN`, `CHRONOKID_PGDATA`, or `CHRONOKID_PG_PORT`. The cluster is not a Windows service, so start it again after a reboot.

## Workspace

- `apps/web`: Vite + TypeScript canvas game (`src/game/`): ten eras defined in `config.ts`, generated layouts in `level.ts`, the pure `simulation.ts`, and canvas art in `render.ts` and `scares.ts`. `/api` is proxied to the API in development.
- `apps/api`: Fastify API, Drizzle schema/migrations, PostgreSQL connection.
- `packages/shared`: Types shared between the browser and API.

The current API only exposes health and readiness endpoints. Player identity, run persistence, scores, and leaderboard routes belong to later phases.

## CI and security checks

GitHub Actions runs on every pull request and every push to `main`. Nothing is deployed.

| Workflow job | What it checks |
| --- | --- |
| Lint, type-check, build, unit tests | oxlint, TypeScript, production builds, Vitest, and that generated migrations are committed |
| Browser tests (desktop and mobile) | Playwright on desktop, portrait phone, and landscape phone; the HTML report is uploaded when a test fails |
| Migrations and API readiness (PostgreSQL) | Migrations apply to an empty PostgreSQL 16 database and re-apply as a no-op; the built API starts and reports ready |
| Dependency audit and signatures | No known vulnerabilities in production dependencies, no high/critical ones anywhere, and npm registry signatures verify |
| Dependency review (pull requests) | Blocks pull requests that add dependencies with known moderate or worse vulnerabilities |
| Workflow security lint (zizmor) | Insecure GitHub Actions patterns (unpinned actions, credential leaks, injection) |
| CodeQL | Security analysis of the TypeScript code and the workflows; also runs weekly |

Workflows use read-only tokens by default, actions are pinned to commit SHAs, and Dependabot waits seven days before proposing new releases.

### Repository settings to turn on

These live in GitHub settings, not in files:

1. **Settings > Rules > Rulesets**: add a branch ruleset for `main` that requires a pull request, blocks force pushes and deletion, and requires these status checks: `Lint, type-check, build, unit tests`, `Browser tests (desktop and mobile)`, `Migrations and API readiness (PostgreSQL)`, `Dependency audit and signatures`, `Workflow security lint (zizmor)`, `CodeQL (javascript-typescript)`, `CodeQL (actions)`. Add `Dependency review (pull requests)` too; it only runs on pull requests.
2. **Settings > Advanced Security**: enable Dependabot alerts, Dependabot security updates, secret scanning with push protection, and private vulnerability reporting. Leave CodeQL "default setup" off; this repository uses the CodeQL workflow (advanced setup).
3. **Settings > Actions > General**: set workflow permissions to "Read repository contents", keep "Allow GitHub Actions to create and approve pull requests" off, and require approval for workflows from outside contributors.

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## Project guardrails

See [PLAN.md](PLAN.md) for current phase status, decisions, risks, and resume instructions. Repository-specific coding and security instructions are in `.github/copilot-instructions.md` and `.github/instructions/api-security.instructions.md`. Use the `Chronokid Review` agent in `.github/agents/chronokid-review.agent.md` for read-only, findings-first code reviews.