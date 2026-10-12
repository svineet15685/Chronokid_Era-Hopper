# Chronokid: Era Hopper Project Plan

Last reviewed: 2026-10-12

## Resume First

1. Read this file and `.github/copilot-instructions.md` before making project changes.
2. Check `git status`, the latest commit, and installed Node/npm/Docker versions. This document is a checkpoint, not a substitute for live state.
3. Preserve uncommitted work. The original single-file prototype (root `index.html`) was deleted after the migration was verified; recover it from git history (`git show ffd243e:index.html`) if needed.
4. Confirm the active phase with the user if scope is unclear. Complete its exit checks and update this plan before pausing again.

## Current Snapshot

- Phase 0 guardrails: complete. Shared instructions, API security rules, resumable plan, CI, Dependabot, and read-only code review agent are in place. Type-check, production build, migration drift check, audit threshold, and env ignore checks passed.
- Phase 1 foundation: complete (2026-10-11). Docker is unavailable and port 5432 belongs to an unrelated PostgreSQL 18 service, so development uses a project-only PostgreSQL 18 cluster created with `initdb` at `%LOCALAPPDATA%\Chronokid\pgdata` on `localhost:5433` (`npm run db:local:start|stop|status`). Its randomly generated password exists only in the ignored root `.env`. Migration `0000_legal_praxagora` is applied. The cluster is not a Windows service; start it after reboots.
- Phase 2 game migration: complete and committed (`ffd243e`, branch `phase-2-game-migration`). The root prototype was deleted at the user's request on 2026-10-12 (recoverable from `ffd243e`).
- Phase 2b ten-era expansion (user-requested scope change, 2026-10-12): complete, committed as `1afa749` on `phase-2-game-migration`. See the Phase 2b section.
- Phase 1 recheck (2026-10-12) after Dependabot major upgrades (TypeScript 7, Vite 8, Zod 4, dotenv 18, @fastify/cors 11, @types/node 26): clean install, type-check, build, high-severity audit, migration drift, and `/api/health/ready` all pass.
- Stack: npm workspaces, Vite + TypeScript client, Fastify + TypeScript API, PostgreSQL + Drizzle, shared TypeScript contracts.
- Security posture: browser gameplay is untrusted/client-authoritative; a leaderboard is casual unless gameplay becomes server-authoritative or runs are independently verified.
- Known dependency note: `npm audit` reported 0 vulnerabilities on 2026-10-12 (earlier moderate Drizzle Kit dev-only findings no longer appear). CI blocks high/critical advisories. Recheck before release.
- Environment note: `.env.example` is the safe local template. API runtime and Drizzle CLI load the root `.env`; local `.env` files are ignored by Git.
- Resolved in Phase 2: at 375x667 portrait the prototype clipped its start button below the 16:9 shell. Portrait layouts now give menus and touch controls the full viewport; a browser check asserts every menu button is fully in view.

## Phases and Exit Checks

### Phase 0: Project Guardrails

Status: complete

- Add the shared Copilot project instructions, scoped API/database security instructions, this resumable plan, CI checks, and Dependabot configuration.
- Ensure local secrets are ignored while `.env.example` remains tracked; ensure API and migration tooling read the documented root `.env`.
- Exit: frontmatter/config is valid; clean install, type-check, build, migration generation, and CI-equivalent checks pass; this plan records remaining environment-only blockers.

### Phase 1: Project Foundation

Status: complete (2026-10-11)

- Create the web/API/shared workspaces, local PostgreSQL Compose service, schema/migration baseline, and health/readiness endpoints.
- Verified: type-check and build pass; `npm run dev` starts web and API; `/api/health` through the Vite proxy returns `ok`; `npm run db:migrate` applied to the local cluster (`players`, `runs`, `drizzle.__drizzle_migrations`); `/api/health/ready` returns 200 `ready`.
- Exit: web and API start together; web proxy reaches API; migration applies to the local development database; database readiness reports ready. Keep the root prototype untouched until Phase 2.

### Phase 2: Game Migration

Status: complete (2026-10-12)

- Migrate the existing canvas gameplay into `apps/web` without changing the three eras, movement/jump controls, hazards, collectibles, sound, transitions, or end states unintentionally.
- Add behavior tests for physics/state transitions and browser checks for start, movement, era progression, and restart. Provide keyboard and touch controls with responsive layout.
- Exit: parity checklist passes, production build works, browser checks pass on desktop and mobile, and only then decide whether the root prototype can be removed or retained as an archive.
- Structure: `apps/web/src/game/` holds `config` (eras, level layout), `simulation` (pure state/physics, unit tested), `render` (canvas), `audio`, and `input`; `src/main.ts` wires the HUD, overlays, and frame loop. A development-only `window.__chronokid` hook lets browser checks warp the player; production builds strip it (verified).
- Verified (2026-10-12): `npm test` 20 Vitest behavior tests pass; `npm run test:e2e` 19 Playwright checks pass across desktop 1280x720, mobile portrait 375x667 (touch), and mobile landscape 915x412 (touch); type-check and production build pass; CI now runs both suites.
- Parity checklist:
  - [x] Constants, era physics (gravity/speed/jump), level layout, hazards, pickups, scoring, lives, invulnerability, knockback, coyote time, jump buffer, camera, and frame-delta clamp copied unchanged (unit tested).
  - [x] Rendering ported line for line; start-screen canvas output is byte-identical to the prototype at desktop, portrait, and landscape sizes. Stone, Medieval, and Future eras visually checked in-game.
  - [x] Keyboard (arrows, WASD, Space/Up/W jump, Enter to start) and touch (left/right hold, jump tap) controls; sound effects and toggle; overlays for start, era clear, victory, game over, and restart.
  - [x] Intentional fixes: (1) portrait start-button clipping; (2) the controls hint is now hidden on non-start overlays as the prototype code intended (its CSS overrode `hidden`); (3) losing the last life and reaching the finish in the same frame now stays a game over instead of clearing the era; (4) overlay titles are built with DOM nodes instead of `innerHTML`.
  - [x] Hands-on playtest by the user; root `index.html` deleted at the user's request.

### Phase 2b: Ten-Era Expansion

Status: complete (2026-10-12), committed as `1afa749`; playtested and approved by the user

- Requested by the user after their child played Phase 2: ten eras, each harder, with jump scares. Decisions: "spooky-silly" scares with an on/off toggle; timeline lineup Stone Age, Ancient Egypt, Viking Age, Medieval, Pirate, Wild West, Haunted Manor, Steam Age, Future, End of Time; mid-level checkpoints.
- Stone Age keeps the original layout and physics. Later eras raise hazard tempo, add pits (0 to 5), hazard counts (9 to 15), crumbling ledges (Egypt, Haunted, End), ice (Viking), droppers, and projectiles. Layouts come from `apps/web/src/game/level.ts` (ground slots for pits and ground hazards, air hazards halfway between).
- Checkpoint flag at x=1720: falling into a pit costs a life and respawns at the last checkpoint and restores crumbled ledges. Game over offers "Retry Era"/"Retry from Checkpoint" (full lives, the era's starting score) or "Start Over". Retry-on-game-over was added beyond the chosen option because ten harder eras without it would strand young players.
- Jump scares (`scares.ts`): one to three per era; the world freezes for 1.1 s while a cartoon creature pops up over the whole screen (a separate viewport-sized canvas) with a shake, flash, and synthesized sound. No captions, by user request. The 👻 toggle and the sound toggle persist in `localStorage` (failures fall back to defaults). Scare spots passed while scares are off are consumed.
- Verified (2026-10-12): 75 Vitest tests (including per-era fairness checks: pits narrower than 70% of the era's jump distance, clear start/checkpoint/finish, no ground hazard swaying into a pit), 25 Playwright checks on desktop and both mobile orientations, type-check, and build. All ten eras and scare creatures were visually reviewed in contact sheets.
- Tuning: difficulty knobs are `tempo`, `spacing`, `pits`, and `pitWidth` per era in `config.ts`. Open item: merge the branch into `main`.

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