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
- CI/CD hardening (2026-10-12, user request; testing and security only, no deployment): `ci.yml` splits into lint/type-check/build/unit, Playwright browser tests (report artifact on failure), PostgreSQL migration + built-API readiness, dependency audit (`--omit=dev` at any severity, all at high) with registry signature verification, PR dependency review, and zizmor workflow linting; `codeql.yml` runs security-extended queries for TypeScript and Actions on PRs, main, and weekly. Actions and the CI PostgreSQL image are pinned by SHA/digest; Dependabot groups updates and uses a 7-day cooldown. oxlint (`npm run lint`) was added because typescript-eslint does not yet support TypeScript 7. Repository settings (main ruleset with required checks, secret scanning push protection, Dependabot alerts, private vulnerability reporting, read-only Actions token) must be enabled by the user; see README. Deployment is deliberately out of scope until the user configures it.
- Stack: npm workspaces, Vite + TypeScript client, Fastify + TypeScript API, PostgreSQL + Drizzle, shared TypeScript contracts.
- Security posture: browser gameplay is untrusted/client-authoritative; a leaderboard is casual unless gameplay becomes server-authoritative or runs are independently verified.
- Known dependency note: the four moderate advisories in Drizzle Kit's development-only `@esbuild-kit` loader are back in `npm audit` (2026-10-12). Production dependencies audit clean. CI fails on any production advisory and on high/critical advisories anywhere. Recheck before release.
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
- Extra lives (2026-10-12, user request): +1 life each time the score passes a multiple of 2,000 (`EXTRA_LIFE_POINTS`), capped at 5 (`MAX_LIVES`), with a jingle, a floating "+1 ♥", and pulsing hearts. Collected pickups stay collected after checkpoint respawns, and game-over retries reset lives to 3, so lives cannot be farmed.
- Tuning: difficulty knobs are `tempo`, `spacing`, `pits`, and `pitWidth` per era in `config.ts`. Open item: merge the branch into `main`.

### Phase 3: Persistence API

Status: implemented on branch `phase-3-persistence-api` (2026-10-12); pending commit, CI, and review

- Add guest identity, run lifecycle, validated result submission, and leaderboard persistence using the existing `players` and `runs` schema as a starting point; revise schema through reviewed migrations.
- Enforce input bounds, ownership, rate limits, generic errors, and persistence tests. Treat client results as casual, not cheat-proof.
- Exit: API integration tests cover success, malformed input, unauthorized access, and database failures; migrations apply cleanly.
- Built: guest players with a random 256-bit bearer token (only its SHA-256 is stored); run start/finish with server-measured duration and plausibility checks (score multiple of 100 and at most 3,000 per era reached: 25 pickups plus 5 secret-room gems, victory only in era 10, at least 8 s per era crossed, finish within 6 h, finish once, owner only with 404 for others); leaderboard of each player's best finished run without player IDs. Rate limits (120/min global, 5/min player creation, 30/min run calls), 4 KB body limit, list-based CORS, `no-store`/`nosniff` headers, generic error codes, 503 when the database is unreachable.
- Migration `0001` adds `players.token_hash` (NOT NULL, unique), the `run_outcome` enum, nullable `duration_ms`, check constraints, and leaderboard indexes. Adding NOT NULL `token_hash` only works on an empty `players` table (true for every environment so far); any populated database would need a backfill plan first.
- `GAME_RULES` in `packages/shared` is the single source for era count, pickups per era, and pickup points, used by the game and the API. Because the API imports runtime values from it, `shared` now builds to `dist/` and exposes a `source` export condition for dev tools. The CI readiness step caught the missing build before merge.
- Verified (2026-10-12): 62 API tests (32 validation unit tests and 30 integration tests against PostgreSQL, including the database-down case), 77 web unit tests, type-check, lint, and a production smoke test of the built API. CI's database job now runs the API integration tests with `REQUIRE_DB_TESTS=1`.
- Known limits: display names are character-restricted but not moderated (no profanity filter); rate limits are in memory, so they reset on restart and are per instance. Revisit both before public release.
- Next action: Phase 4 client integration (name entry, run submission, leaderboard view, offline handling).

### Phase 4: Client Integration

Status: implemented on branch `phase-4-client-integration` (2026-10-12); pending commit, CI, and review

- Add display-name setup, run submission, best-score/leaderboard views, and loading/error/offline states.
- Exit: an end-to-end browser flow persists a completed run and renders the returned result without breaking local single-player play.
- Decisions (user, 2026-10-12): leaderboard names come from a fun name picker (`Adjective Animal Number` from shared word lists; the API rejects anything else), so no moderation is needed and no real names appear; the game asks after the first finished game; when the API is unreachable the game plays normally with a quiet notice (no retry queue).
- Built: the game quietly creates an unlisted guest on first play (token kept in `localStorage`), registers each run when play starts, and submits on game over or victory. "Retry" registers a continuation run (`continues`) that the server times from the original start, so later finishes stay plausible. End screens show saving status, the name picker (🎲 for another name, "Add me", "No thanks"), and rank / personal best once listed. A 🏆 Leaderboard screen lists each listed player's best run and highlights yours. All network failures degrade to a notice; nothing blocks play.
- API additions: `players.listed` (migration 0002, default false, safe on populated tables), `PATCH /api/players/me`, leaderboard rank in finish and opt-in responses (same ordering as the board), run continuation, and `RATE_LIMIT_SCALE` for automated tests only.
- Layout: menus now scroll when taller than their space and use the whole viewport on short landscape screens (with compact type) and for the leaderboard; portrait toggles moved to the screen corner. These fixed real clipping found by the new browser tests (the Back button was unreachable once the board had several rows).
- Verified (2026-10-12): 85 web unit tests (including the online session against a fake API: offline, server errors, refusals, expired tokens, retries, opting in), 78 API tests, and 49 Playwright runs across desktop, portrait, and landscape, including the full-stack flow against a real API and `_test` database and the offline flow. CI's browser job now has its own PostgreSQL and requires the full-stack tests.
- Known limits: guest tokens live in `localStorage` (an XSS bug could read them; all network text is rendered with `textContent`); clearing browser data creates a new guest. There is no "leave the leaderboard" option yet.
- Next action: Phase 5 release readiness.

### Phase 5: Release Readiness

Status: implemented on branch `phase-5-release-readiness` (2026-10-13); pending commit, CI, and review. Deployment itself is deliberately not done; the user will configure hosting later.

- Complete accessibility/responsive checks, security/dependency review, deployment configuration, backups/migration runbook, and operational health checks.
- Exit: CI is green, secrets are configured outside source control, deployment and rollback are documented, and score-integrity limitations are visible to operators/users.
- Decision (user, 2026-10-13): one container image in which the API serves the built game (same origin), rather than a separate static host.
- Built: `STATIC_DIR` static serving (`@fastify/static`, one route per built file, hashed assets cached for a year, page `no-cache`); security headers on every response (strict CSP without `unsafe-inline`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP); runtime-only migration script (`node apps/api/dist/migrate.js`); multi-stage `Dockerfile` (digest-pinned Alpine Node 22, `npm ci --ignore-scripts`, dev deps pruned, non-root, read-only files, HEALTHCHECK); `.dockerignore`; example `compose.production.yaml` (migrate-then-app, read-only, no capabilities, localhost-only port); Dependabot for Docker and Compose images; CI job **Container image builds and serves the game**.
- Accessibility: axe (WCAG 2.1 A/AA) checks on the start, game-over, and leaderboard screens; keyboard-only flow test; end screens focus their main button (fixed a visibility transition that made the menus unfocusable for one frame); visible focus rings; leaderboard is a labelled modal dialog with Escape to close; `prefers-reduced-motion` disables menu animation, scare screen shake, flash, and pop-in.
- Users see the casual-score limitation on the leaderboard screen; operators in `docs/operations.md`, which also covers configuration, least-privilege database roles, deploy, rollback (forward-only, backward-compatible migrations), backups with a monthly restore drill, health checks, TLS/HSTS at the proxy, single-instance rate limits, maintenance SQL, monitoring, password rotation, and a release checklist.
- Verified (2026-10-13): a production build served by the built API loads with the CSP and no browser console errors, and the test hook is absent; the Dockerfile's steps rehearsed outside Docker (clean `npm ci --ignore-scripts`, build, prune to 46 MB, migrate and serve from the runtime layout). 81 API tests, 85 web tests, and 59 Playwright runs pass. The image itself is first built by CI, since Docker is not installed locally.
- Next action: push, confirm the new container job and the rest of CI pass, then work through the release checklist in `docs/operations.md` when choosing a host.

### Phase 6: Fun and Engagement (kids)

Status: in progress (started 2026-10-13; 6.1 to 6.12 done 2026-10-14, next: 6.13 installable app). Ordered from easy to hard; work top to bottom and tick items when merged. Every item keeps the safety rules: no chat, no typed text, picked names only, and the game never blocks on the network.

- [x] 6.1 Power-ups: shield (absorbs one hit), time freeze (hazards stop for a few seconds), magnet (pulls nearby pickups), double jump. Two per era, shown with an on-screen timer. Done 2026-10-14 (branch `fun-1-powerups-stars-levels`): boxes float above two ledges per era, kinds rotate by era; freeze uses a separate hazard clock; timer badges bottom-left; shield bubble and icy tint on frozen hazards.
- [x] 6.2 Star ratings: 1 star for clearing an era, +1 for collecting at least 20 of 25 pickups, +1 for taking no damage. Best stars per era are remembered on the device. Done 2026-10-14: stars and tips for missed stars on the era-clear screen; shield blocks do not count as hits; progress in `localStorage` (`chronokid.progress`), sanitized on load.
- [x] 6.3 Level-select map: replay any era already reached, as practice (practice runs do not go on the leaderboard). Done 2026-10-14: 🗺️ Eras dialog with locked eras and best stars; practice runs are never submitted.
- [x] 6.4 Fun feedback: pickup combos ("x5!"), a celebration for a perfect era, a victory dance. Done 2026-10-14 (branch `fun-2-feedback`): pickups within 1.2 s build a combo with a rising-pitch chime and "x2", "x3"... "x5!" popups (cosmetic only, score unchanged); 3-star eras and the final victory get confetti and a fanfare; Chronokid dances on clear and victory screens. Confetti and the dance are skipped for reduced motion.
- [x] 6.5 Spooky mode (requested by the player, intensity chosen by the parent 2026-10-14): a grown-ups setting (behind a simple multiplication gate) for scares Off / Silly / Spooky. Spooky is presentation only: darker levels with a glow around Chronokid, fog, blinking eyes, a low drone, a heartbeat near hazards, and scares with a short blackout and red-tinted backdrop. Cartoon style; no blood, gore, or realistic violence. The kid's 👻 toggle still turns scares off and on. Done 2026-10-14 (branch `fun-2-feedback`): ⚙ Grown-ups on the start screen asks a single-digit multiplication (a parental gate, not a security control), then offers Off (locks 👻) / Silly / Spooky, saved as `chronokid.scareStyle`. Spooky adds darkness with a glow around the hero, soft fog, blinking eyes, a drone, a heartbeat near hazards, occasional whispers, scares that open with a 0.3 s blackout on a red-edged backdrop, and 30% louder scare sounds. Flicker and flashes respect reduced motion; game rules and scoring are unchanged.
- [x] 6.6 Unlockable looks: hats and outfits earned with stars (caveman helmet, Viking horns, pirate eyepatch, astronaut helmet). Done 2026-10-14 (branch `fun-3-looks`): 👕 Looks wardrobe with live previews; ten looks unlocked by total best stars (Classic 0, Caveman 3, Pharaoh 6, Viking 9, Pirate 12, Pumpkin Head 14, Cowboy 17, Vampire Cape 20, Astronaut 24, Golden Crown 30); the era-clear screen announces new unlocks; choice saved as `chronokid.outfit` and falls back to Classic if its stars are not earned. Cosmetic only.
- [x] 6.7 Difficulty choice: Easy (extra lives, slower hazards) and Hard, chosen on the start screen; leaderboard runs use Normal. Done 2026-10-14 (branch `fun-4-difficulty`): Easy 5 lives (max 7), hazards at 75%, 2 s recovery; Normal unchanged; Hard 2 lives (max 3), hazards at 125%, 0.9 s recovery. Saved as `chronokid.difficulty`; applies to practice too. Decision change: Hard runs also go on the leaderboard (never easier than Normal); Easy runs do not. Arrow keys and Space work on the switch; Enter still starts the game.
- [x] 6.8 Background music: a synthesized tune per era (no audio files), faster during danger, with its own mute toggle. Done 2026-10-14 (branch `fun-5-music`): `game/music.ts` holds ten 32-step tunes (era scales, lead voices, tribal/march/beat drums) and a lookahead scheduler on the audio clock; tempo +15% on the last life; Spooky mode plays a slower minor-key version; plays only during gameplay (not menus, scares, or hidden tabs); 🎶 toggle saved as `chronokid.music`, and ♫ still silences everything.
- [x] 6.9 Intro story: three or four comic panels on first launch explaining the broken time machine; skippable. Done 2026-10-14 (branch `fun-6-story`): four canvas panels in the game's blocky style (time machine, ZAP, ten-era timeline, off to fix it) with Next/Skip, Enter/→/Esc, and a 📖 Story link to replay; shown once on first launch (`chronokid.introSeen`); still frames for reduced motion. Browser tests start as returning visitors so the story does not cover the menus.
- [x] 6.10 Bosses: one per era with simple, readable patterns, starting with the Stone Age T-rex. Done 2026-10-14 (branch `fun-7-bosses`): every era ends with a boss in a 760 px arena (pits and hazards are laid out before it): T-rex, Giant Mummy, Frost Troll, Dragon, Kraken, Bandit Bull, Ghost King, Steam Golem, Mega Robot, Time Eater. Rules live in `game/boss.ts` and art in `game/boss-art.ts`. Three attack types, each with a warning: stomp (ground wave to jump), rain (objects land on growing shadows), and volley (shots low, high, low; the high one passes over a standing player). After each attack the boss is tired with its head down and dizzy stars; stomping its head ("BONK!") is the only way to hit it, 3 hits early, 4 mid, 5 for the Time Eater. Beaten bosses run away (no gore); the flag stays locked until then; the camera holds the arena; speed follows era and difficulty; retries reset the fight; a named health bar shows remaining hits. The Stone Age lost its last three original boulders to its arena.
- [x] 6.11 Secret areas: hidden doors and breakable walls leading to bonus rooms. Done 2026-10-14 (branch `fun-8-secrets`): every era hides a cracked, softly glowing "?" block above its third ledge (a solid one, never a crumbling one). Bonking it from below opens a swirling time portal on the ledge; after a moment it can be entered. Inside is a safe, starry room with two ledges, 5 golden gems (100 points each, not counted toward the pickup star) and +1 life (up to the difficulty limit), with an exit portal back to the same ledge. No checkpoint, clear or scares happen inside; retries hide the block again. The era map shows 🔍 on eras whose secret was found (saved per device). Server score limits rose to 3,000 per era reached (`maxScoreForEras` in the shared package).
- [x] 6.12 Achievements and stickers: a sticker book of goals ("collect every berry", "beat the Kraken without a hit"). Done 2026-10-14 (branch `fun-9-stickers`): 18 stickers (First Hop, Berry Picker, Full Basket, Untouchable, Superstar, Star Collector, Combo Champ, Lucky Heart, Power Player, Saved by the Bubble, Explorer, Master Explorer, Boss Bonker, Flawless, Kraken Tamer, Brave Heart, Dress Up, Time Champion). Rules are pure checks on game events in `stickers.ts` (unit tested); a boss counts as no-hit when no hits land after its intro roar. A "New sticker!" banner (status live region, never blocks play) shows each one with a chime; the 🏅 Stickers book shows every goal, earned ones in colour. Saved per device in `chronokid.stickers`, sanitized on load; never sent to the server.
- [ ] 6.13 Installable app: web app manifest, icons, and offline play ("Add to home screen").
- [ ] 6.14 Daily challenge: one shared seeded level per day with its own small leaderboard (API changes).
- [ ] 6.15 Two players on one device: shared screen, second character on WASD or split touch controls.
- [ ] 6.16 Crew leaderboard: join a friends group with a picked share code (for example TIGER-42); no chat (API changes).

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