// Starts/stops a project-only PostgreSQL cluster created with initdb (no Docker required).
// Override locations with CHRONOKID_PG_BIN, CHRONOKID_PGDATA, and CHRONOKID_PG_PORT.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const action = process.argv[2];
if (!['start', 'stop', 'status'].includes(action)) {
  console.error('Usage: node scripts/local-db.mjs <start|stop|status>');
  process.exit(1);
}

const dataDir =
  process.env.CHRONOKID_PGDATA ??
  join(process.env.LOCALAPPDATA ?? join(homedir(), '.local', 'share'), 'Chronokid', 'pgdata');
const port = process.env.CHRONOKID_PG_PORT ?? '5433';
const pgCtl = process.env.CHRONOKID_PG_BIN
  ? join(process.env.CHRONOKID_PG_BIN, 'pg_ctl')
  : process.platform === 'win32'
    ? 'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_ctl.exe'
    : 'pg_ctl';

if (!existsSync(dataDir)) {
  console.error(`No cluster at ${dataDir}. See README "Local database without Docker".`);
  process.exit(1);
}

const args = ['-D', dataDir];
if (action === 'start') {
  args.push('-o', `-p ${port} -c listen_addresses=localhost`, '-l', join(dirname(dataDir), 'postgres.log'), '-w');
}
args.push(action);

const result = spawnSync(pgCtl, args, { stdio: 'inherit' });
if (result.error) {
  console.error(`Could not run ${pgCtl}: ${result.error.message}. Set CHRONOKID_PG_BIN.`);
  process.exit(1);
}
process.exit(result.status ?? 1);
