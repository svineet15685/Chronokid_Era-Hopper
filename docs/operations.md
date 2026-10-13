# Operations Runbook

How to run Chronokid in production: one container image (the API also serves the built game) plus PostgreSQL. Nothing in this repository deploys automatically; CI only proves the image builds, migrates, and serves the game.

## What the service stores

- `players`: a random UUID, a generated display name such as `Brave Otter 27` (never typed by the player), the SHA-256 hash of the player's bearer token, whether they joined the leaderboard, and when they were created.
- `runs`: score, era reached, outcome, server-measured duration, and start/finish times.
- No email, passwords, real names, or analytics. Client IP addresses appear only in request logs (and in memory for rate limiting).

## Configuration

Set these as environment variables through your host's secret or config store. Never commit them.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes, secret | `postgres://user:password@host:5432/db`. Use a long random URL-safe password. In production, connect as the least-privileged app role (below). |
| `WEB_ORIGIN` | yes | The public site address, for example `https://game.example.com`. Used for CORS. |
| `TRUST_PROXY` | yes, if behind a proxy | `true` only behind a trusted reverse proxy that sets `X-Forwarded-For`; otherwise clients can spoof their IP and dodge rate limits. |
| `API_HOST`, `API_PORT` | no | The image defaults to `0.0.0.0:3001`. |
| `STATIC_DIR` | no | Preset in the image to the built game. |
| `RATE_LIMIT_SCALE` | never | Test-only multiplier for rate limits. Leave unset in production. |

## Build the image

```sh
docker build --tag chronokid:$(git rev-parse --short HEAD) .
```

Tag images with the commit so any release can be rolled back to exactly. The image runs as the unprivileged `node` user, its files are read-only to that user, and it works with a read-only root filesystem.

## Database roles (least privilege)

Run migrations with an owner role and the app with a role that can only read and write rows:

```sql
-- As a database administrator, once:
CREATE ROLE chronokid_owner LOGIN PASSWORD '<random>';
CREATE ROLE chronokid_app   LOGIN PASSWORD '<random>';
CREATE DATABASE chronokid OWNER chronokid_owner;
\c chronokid
GRANT USAGE ON SCHEMA public TO chronokid_app;
-- After migrations have created the tables (re-run after migrations that add tables):
GRANT SELECT, INSERT, UPDATE, DELETE ON players, runs TO chronokid_app;
```

Use `chronokid_owner` in the migration step's `DATABASE_URL` and `chronokid_app` in the app's.

## Deploy a new version

1. Confirm CI is green on the commit (all required checks, including **Container image builds and serves the game**).
2. Back up the database (see Backups) if the release contains a migration.
3. Run migrations once, with the new image: `docker run --rm -e DATABASE_URL=<owner url> chronokid:<tag> node apps/api/dist/migrate.js`. It prints `Migrations are up to date.` and exits 0, or exits non-zero on failure (stop and investigate; the app is still on the old version).
4. Start the new app container (or roll your service to the new tag).
5. Check `GET /api/health/ready` returns `200 {"status":"ready"}`, load the site, and look at the logs for errors.

`compose.production.yaml` shows the same flow for a single host: `migrate` runs to completion before `app` starts.

## Roll back

- **App only (the usual case):** redeploy the previous image tag. Migrations in this project must stay backward compatible (add columns with defaults, add tables, never drop or rename in the same release), so the previous version keeps working against the newer schema.
- **A migration must be undone:** migrations are forward-only. Restore the pre-release backup into a new database, point the app at it, and redeploy the previous tag. This loses data written since the backup, so it needs explicit approval.
- Destructive schema changes (dropping or renaming columns) need a two-release plan (stop using it, then remove it) and a backup taken immediately before.

## Health checks and shutdown

- `GET /api/health`: liveness (the process is up). The image's Docker `HEALTHCHECK` uses it.
- `GET /api/health/ready`: readiness (can reach PostgreSQL); returns 503 when the database is unavailable. Use it for load-balancer readiness.
- The app closes cleanly on `SIGTERM`/`SIGINT`, finishing in-flight requests and closing database connections.

## Reverse proxy and TLS

Terminate TLS at a reverse proxy or the platform's load balancer and forward to port 3001. Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` there (the app cannot know it is behind HTTPS). Set `TRUST_PROXY=true` only in this setup.

The app sets its own `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `X-Content-Type-Options` headers.

**Run one instance.** Rate limits are kept in memory, so several instances would each allow the full limit and restarts reset the counters. Scaling out needs a shared rate-limit store (for example Redis) first.

## Backups

- Prefer a managed PostgreSQL with automated daily backups and point-in-time recovery.
- Otherwise, take a daily logical backup and keep 7 daily and 4 weekly copies, encrypted and stored off the host:

  ```sh
  pg_dump --format=custom --no-owner "$DATABASE_URL" > chronokid-$(date +%F).dump
  # Single-host Compose stack:
  docker compose -f compose.production.yaml exec -T db pg_dump --format=custom --no-owner -U chronokid chronokid > chronokid-$(date +%F).dump
  ```

- **Test a restore every month.** An untested backup is not a backup:

  ```sh
  createdb chronokid_restore_check
  pg_restore --no-owner --dbname=chronokid_restore_check chronokid-YYYY-MM-DD.dump
  psql chronokid_restore_check -c "select count(*) from players; select count(*) from runs;"
  dropdb chronokid_restore_check
  ```

## Routine maintenance

Runs that were started but never finished (closed tab, offline) are harmless but accumulate. They can never be finished after six hours, so delete old ones periodically:

```sql
DELETE FROM runs WHERE completed_at IS NULL AND started_at < now() - interval '1 day';
```

Remove a player and all their runs (for example on request), by display name or ID:

```sql
DELETE FROM players WHERE display_name = 'Brave Otter 27';  -- runs cascade
```

## Monitoring

Logs are JSON lines (request method, URL, status, timing). They never include bearer tokens or database credentials. Alert on:

- readiness failing (database unreachable),
- a rising rate of 5xx responses (`"error":"internal"` or `"unavailable"`),
- spikes in 429s (abuse or a misconfigured `TRUST_PROXY`),
- many `rejected implausible run` log lines (someone probing the score checks).

## Rotate the database password

1. Create the new password on the role (`ALTER ROLE chronokid_app PASSWORD '<new>'`).
2. Update `DATABASE_URL` in the host's secret store and restart the app.
3. Confirm readiness, then make sure the old password no longer works.

Player tokens cannot be rotated in bulk; a player who loses theirs (cleared browser data) simply starts as a new guest.

## Known limitations

- **The leaderboard is casual.** The game runs in the browser, so the server can only reject impossible results (too many points for the eras reached, a victory before era 10, runs faster than the eras allow, runs older than six hours). It cannot prove a score was earned. The leaderboard screen tells players this.
- Guest tokens live in the browser's `localStorage`. All server text is rendered as text, never HTML, which keeps cross-site-scripting risk low, but an XSS bug would expose tokens.
- There is no "leave the leaderboard" option yet; remove a player with the SQL above.

## Release checklist

- [ ] CI green on the release commit, with the `main` branch ruleset requiring the checks listed in the README.
- [ ] `DATABASE_URL`, `WEB_ORIGIN`, and `TRUST_PROXY` set in the host's secret/config store (not in files).
- [ ] App runs as the least-privileged database role; migrations as the owner role.
- [ ] TLS and HSTS at the proxy; site reachable only over HTTPS.
- [ ] Automated backups enabled and one restore tested.
- [ ] Readiness check and alerts wired to `/api/health/ready`.
- [ ] One app instance (until a shared rate-limit store exists).
