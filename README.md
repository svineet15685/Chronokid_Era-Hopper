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
- `npm run test:e2e`: Playwright browser checks on desktop and mobile viewports. Install the browser once with `npx playwright install chromium`. They start their own Vite server on port 5174 and, when `TEST_DATABASE_URL` is set, a real API on port 3101 against that `_test` database (migrated and emptied first), so the leaderboard flow is tested end to end. Without it, only the full-stack tests are skipped; offline behavior is always tested.

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

## API

Guest players get a random bearer token; the server stores only its SHA-256 hash. Send it as `Authorization: Bearer <token>`. The game creates an unlisted guest quietly on first play (so runs can be timed from their start) and lists the player on the leaderboard only after they opt in.

Display names are picked, not typed: they must be `Adjective Animal Number` from the word lists in `packages/shared/src/names.ts` (for example `Brave Otter 27`), so nothing rude or personal can appear on the public leaderboard.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/health` | none | Liveness |
| `GET /api/health/ready` | none | Database readiness (503 when the database is down) |
| `POST /api/players` | none | Create an unlisted guest player: `{ "displayName": "Brave Otter 27" }` returns the player and token. 5 per minute per IP |
| `PATCH /api/players/me` | token | `{ "displayName"?, "listed": true }`: pick a new name and/or join the leaderboard; returns the player's rank |
| `GET /api/players/me` | token | Profile and best finished run |
| `POST /api/runs` | token | Start a run; the server records the start time. `{ "continues": "<finished run id>" }` continues a run after "Retry", timed from the original start |
| `POST /api/runs/:runId/finish` | token, owner | `{ "score", "eraReached", "outcome" }`; the server measures the duration, rejects impossible results, and returns the leaderboard rank when listed |
| `GET /api/leaderboard?limit=10` | none | Each listed player's best finished run (1 to 50 entries); no player IDs |

Errors are always `{ "error": "<code>" }` with a generic code (`invalid_request`, `unauthorized`, `not_found`, `conflict`, `rate_limited`, `unavailable`, `internal`). Requests are rate limited (120 per minute per IP overall) and bodies are capped at 4 KB. Set `TRUST_PROXY=true` only behind a trusted reverse proxy.

**The leaderboard is casual.** The game runs in the browser, so the API can only reject impossible results (more points than the eras hold, a victory before era 10, runs faster than the eras allow, runs older than six hours); it cannot prove a score was earned.

API integration tests run against a real PostgreSQL database named by `TEST_DATABASE_URL`. They wipe its tables, so the database name must end in `_test` (the tests refuse to run otherwise). Without `TEST_DATABASE_URL` they are skipped locally; CI sets `REQUIRE_DB_TESTS=1` so they can never be skipped there.

## Production and deployment

The app ships as one container image: the API also serves the built game, so the game and API share an address. Nothing deploys automatically.

- Build: `docker build --tag chronokid:<tag> .` (see [Dockerfile](Dockerfile)).
- Try the production setup on one machine: `POSTGRES_PASSWORD=<random> PUBLIC_URL=http://localhost:3001 docker compose -f compose.production.yaml up --build`.
- Configuration, deploying, rolling back, backups, health checks, and the release checklist: [docs/operations.md](docs/operations.md).

## CI and security checks

GitHub Actions runs on every pull request and every push to `main`. Nothing is deployed.

| Workflow job | What it checks |
| --- | --- |
| Lint, type-check, build, unit tests | oxlint, TypeScript, production builds, Vitest, and that generated migrations are committed |
| Browser tests (desktop and mobile) | Playwright on desktop, portrait phone, and landscape phone, including automated accessibility checks (axe, WCAG 2.1 A/AA) and keyboard-only play; the HTML report is uploaded when a test fails |
| Migrations and API readiness (PostgreSQL) | Migrations apply to an empty PostgreSQL 16 database and re-apply as a no-op; API integration tests run against it; the built API starts and reports ready |
| Container image builds and serves the game | Builds the Docker image, checks it runs as non-root with a read-only filesystem, runs migrations from it, and checks the served page, security headers, and API |
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