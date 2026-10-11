# Chronokid: Era Hopper Project Plan

Last reviewed: 2026-10-11

## Resume First

1. Read this file and `.github/copilot-instructions.md` before making project changes.
2. Check `git status`, the latest commit, and installed Node/npm/Docker versions. This document is a checkpoint, not a substitute for live state.
3. Preserve uncommitted work. The root `index.html` is the original playable game prototype; keep it tracked during Phase 2 and do not delete it before parity is checked.
4. Confirm the active phase with the user if scope is unclear. Complete its exit checks and update this plan before pausing again.

## Current Snapshot

- Phase 0 guardrails: complete. Shared instructions, API security rules, resumable plan, CI, Dependabot, and read-only code review agent are in place. Type-check, production build, migration drift check, audit threshold, and env ignore checks passed.
- Phase 1 foundation: scaffold committed as `eb0413a`. Type-check, builds, and migration generation passed. Migration is still pending: Docker is unavailable, and the local PostgreSQL server rejects the default `chronokid` user with authentication error `28P01`. No migration was applied.
- Phase 2 game migration: next; not started. Preserve all prototype behavior and keep the root prototype recoverable until migration parity is demonstrated.
- Stack: npm workspaces, Vite + TypeScript client, Fastify + TypeScript API, PostgreSQL + Drizzle, shared TypeScript contracts.
- Security posture: browser gameplay is untrusted/client-authoritative; a leaderboard is casual unless gameplay becomes server-authoritative or runs are independently verified.
- Known dependency note: production dependencies audited clean; the full audit reports four moderate findings in Drizzle Kit's development-only legacy esbuild loader. CI blocks high/critical advisories. Recheck before release and do not force unsafe major downgrades merely to silence the report.
- Environment note: `.env.example` is the safe local template. API runtime and Drizzle CLI load the root `.env`; local `.env` files are ignored by Git.
- Review finding to carry into Phase 2: at a 375x667 portrait viewport, the prototype's start button is clipped below the game shell. Fix responsive start-screen sizing before calling the migrated game playable on mobile.

## Phases and Exit Checks

### Phase 0: Project Guardrails

Status: complete

- Add the shared Copilot project instructions, scoped API/database security instructions, this resumable plan, CI checks, and Dependabot configuration.
- Ensure local secrets are ignored while `.env.example` remains tracked; ensure API and migration tooling read the documented root `.env`.
- Exit: frontmatter/config is valid; clean install, type-check, build, migration generation, and CI-equivalent checks pass; this plan records remaining environment-only blockers.

### Phase 1: Project Foundation

Status: scaffold complete; local database authentication blocked

- Create the web/API/shared workspaces, local PostgreSQL Compose service, schema/migration baseline, and health/readiness endpoints.
- Next action: either have the local PostgreSQL owner provision the `chronokid` development database/user and set its connection in the ignored root `.env`, or run Compose with an available host port and matching `DATABASE_URL`; host port 5432 is currently occupied. Do not share credentials in chat.
- Exit: web and API start together; web proxy reaches API; migration applies to the local development database; database readiness reports ready. Keep the root prototype untouched until Phase 2.

### Phase 2: Game Migration

Status: not started

- Migrate the existing canvas gameplay into `apps/web` without changing the three eras, movement/jump controls, hazards, collectibles, sound, transitions, or end states unintentionally.
- Add behavior tests for physics/state transitions and browser checks for start, movement, era progression, and restart. Provide keyboard and touch controls with responsive layout.
- Exit: parity checklist passes, production build works, browser checks pass on desktop and mobile, and only then decide whether the root prototype can be removed or retained as an archive.

### Phase 3: Persistence API

Status: not started

- Add guest identity, run lifecycle, validated result submission, and leaderboard persistence using the existing `players` and `runs` schema as a starting point; revise schema through reviewed migrations.
- Enforce input bounds, ownership, rate limits, generic errors, and persistence tests. Treat client results as casual, not cheat-proof.
- Exit: API integration tests cover success, malformed input, unauthorized access, and database failures; migrations apply cleanly.

### Phase 4: Client Integration

Status: not started

- Add display-name setup, run submission, best-score/leaderboard views, and loading/error/offline states.
- Exit: an end-to-end browser flow persists a completed run and renders the returned result without breaking local single-player play.

### Phase 5: Release Readiness

Status: not started

- Complete accessibility/responsive checks, security/dependency review, deployment configuration, backups/migration runbook, and operational health checks.
- Exit: CI is green, secrets are configured outside source control, deployment and rollback are documented, and score-integrity limitations are visible to operators/users.

## Decisions and Scope Boundaries

- MVP identity is guest-based; do not add passwords, email, OAuth, or account recovery without a new scope decision.
- Keep the real-time game loop in the browser. Do not promise competitive anti-cheat until authority or independent run verification is implemented.
- No multiplayer, payments, analytics collection, or external game assets are in the current scope.
- Keep server-only secrets, database access, and authorization out of `apps/web` and `packages/shared`.

## Pause Handoff Template

Before stopping work, update this file with:

- Current phase/status and the last completed acceptance check.
- Files changed and any intentionally uncommitted work.
- Commands/tests run and their results; note blockers separately from failures.
- Decisions made, unresolved questions, and new risks.
- The single next concrete action and its expected verification.