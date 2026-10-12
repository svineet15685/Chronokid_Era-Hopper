import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDatabase, type Database } from '../src/db/index.js';
import { MIN_ERA_MS } from '../src/validation.js';
import { TEST_DATABASE_URL, assertTestDatabase, dbTestsEnabled } from './test-database.js';

const ORIGIN = 'http://localhost:5173';
type App = Awaited<ReturnType<typeof buildApp>>;

interface Harness {
  app: App;
  database: Database;
  /** Moves the injected clock forward. */
  advance(ms: number): void;
}

/** A fresh app (and so fresh rate-limit counters) for every test, on an empty test database. */
async function createHarness(): Promise<Harness> {
  assertTestDatabase(TEST_DATABASE_URL);
  const database = createDatabase(TEST_DATABASE_URL);
  await database.db.execute(sql`truncate table runs, players restart identity cascade`);
  let clock = Date.parse('2026-10-12T10:00:00Z');
  const app = await buildApp({ database, webOrigin: ORIGIN, logger: false, now: () => new Date(clock) });
  return { app, database, advance: ms => { clock += ms; } };
}

const auth = (token: string) => ({ authorization: `Bearer ${token}` });

async function createPlayer(app: App, displayName = 'Brave Otter 1') {
  const response = await app.inject({ method: 'POST', url: '/api/players', payload: { displayName } });
  expect(response.statusCode).toBe(201);
  return response.json<{ player: { id: string; displayName: string; listed: boolean }; token: string }>();
}

function joinLeaderboard(app: App, token: string, payload: Record<string, unknown> = { listed: true }) {
  return app.inject({ method: 'PATCH', url: '/api/players/me', headers: auth(token), payload });
}

async function startRun(app: App, token: string): Promise<string> {
  const response = await app.inject({ method: 'POST', url: '/api/runs', headers: auth(token) });
  expect(response.statusCode).toBe(201);
  return response.json<{ runId: string }>().runId;
}

function finishRun(app: App, token: string, runId: string, payload: Record<string, unknown>) {
  return app.inject({ method: 'POST', url: `/api/runs/${runId}/finish`, headers: auth(token), payload });
}

describe.skipIf(!dbTestsEnabled)('API with PostgreSQL', () => {
  let h: Harness;
  beforeEach(async () => { h = await createHarness(); });
  afterEach(async () => { await h.app.close(); });

  describe('players', () => {
    it('creates a guest player and stores only a hash of the token', async () => {
      const { player, token } = await createPlayer(h.app, '  Zippy   Zebra 9 ');
      expect(player).toMatchObject({ displayName: 'Zippy Zebra 9', listed: false });
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const rows = await h.database.db.execute<{ token_hash: string }>(sql`select token_hash from players`);
      expect(rows[0].token_hash).toBe(createHash('sha256').update(token).digest('hex'));
      const dump = JSON.stringify(await h.database.db.execute(sql`select * from players`));
      expect(dump).not.toContain(token);
    });

    it.each([
      ['an empty name', { displayName: '' }],
      ['a typed-in name', { displayName: 'Ada' }],
      ['a name outside the word lists', { displayName: 'Evil Otter 3' }],
      ['markup', { displayName: '<b>hi</b>' }],
      ['an extra field', { displayName: 'Brave Otter 1', isAdmin: true }],
      ['a wrong type', { displayName: ['Brave Otter 1'] }]
    ])('rejects %s with a generic 400', async (_label, payload) => {
      const response = await h.app.inject({ method: 'POST', url: '/api/players', payload });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'invalid_request' });
    });

    it('rejects malformed JSON, a missing body, and oversized bodies', async () => {
      const malformed = await h.app.inject({ method: 'POST', url: '/api/players', headers: { 'content-type': 'application/json' }, payload: '{"displayName":' });
      expect(malformed.statusCode).toBe(400);
      expect(malformed.json()).toEqual({ error: 'invalid_request' });
      const missing = await h.app.inject({ method: 'POST', url: '/api/players' });
      expect(missing.statusCode).toBe(400);
      const huge = await h.app.inject({ method: 'POST', url: '/api/players', payload: { displayName: 'Brave Otter 1', pad: 'x'.repeat(10_000) } });
      expect(huge.statusCode).toBe(413);
      expect(huge.json()).toEqual({ error: 'invalid_request' });
    });

    it('returns the authenticated profile and best finished run', async () => {
      const { player, token } = await createPlayer(h.app);
      const me = await h.app.inject({ method: 'GET', url: '/api/players/me', headers: auth(token) });
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual({ player, best: null });

      const runId = await startRun(h.app, token);
      h.advance(30_000);
      await finishRun(h.app, token, runId, { score: 1200, eraReached: 2, outcome: 'gameover' });
      const after = await h.app.inject({ method: 'GET', url: '/api/players/me', headers: auth(token) });
      expect(after.json().best).toEqual({ score: 1200, eraReached: 2, outcome: 'gameover' });
    });

    it.each([
      ['no header', {}],
      ['a non-bearer scheme', { authorization: 'Basic abc' }],
      ['a malformed token', { authorization: 'Bearer short' }],
      ['an unknown token', { authorization: `Bearer ${'A'.repeat(43)}` }]
    ])('rejects %s with a generic 401', async (_label, headers) => {
      const response = await h.app.inject({ method: 'GET', url: '/api/players/me', headers });
      expect(response.statusCode).toBe(401);
      expect(response.json()).toEqual({ error: 'unauthorized' });
    });
  });

  describe('runs', () => {
    it('starts and finishes a run, timing it on the server', async () => {
      const { token } = await createPlayer(h.app);
      const runId = await startRun(h.app, token);
      h.advance(45_000);
      const response = await finishRun(h.app, token, runId, { score: 2500, eraReached: 2, outcome: 'gameover', });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        run: { id: runId, score: 2500, eraReached: 2, outcome: 'gameover', durationMs: 45_000 },
        personalBest: true,
        rank: null
      });
    });

    it('requires a token to start or finish runs', async () => {
      const start = await h.app.inject({ method: 'POST', url: '/api/runs' });
      expect(start.statusCode).toBe(401);
      const { token } = await createPlayer(h.app);
      const runId = await startRun(h.app, token);
      const finish = await h.app.inject({ method: 'POST', url: `/api/runs/${runId}/finish`, payload: { score: 0, eraReached: 1, outcome: 'gameover' } });
      expect(finish.statusCode).toBe(401);
    });

    it("hides other players' runs as not found", async () => {
      const owner = await createPlayer(h.app, 'Happy Koala 1');
      const other = await createPlayer(h.app, 'Happy Koala 2');
      const runId = await startRun(h.app, owner.token);
      h.advance(20_000);
      const response = await finishRun(h.app, other.token, runId, { score: 100, eraReached: 1, outcome: 'gameover' });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: 'not_found' });
      const ownerFinish = await finishRun(h.app, owner.token, runId, { score: 100, eraReached: 1, outcome: 'gameover' });
      expect(ownerFinish.statusCode).toBe(200);
    });

    it('returns 404 for unknown runs and 400 for malformed run ids', async () => {
      const { token } = await createPlayer(h.app);
      const unknown = await finishRun(h.app, token, '00000000-0000-4000-8000-000000000000', { score: 0, eraReached: 1, outcome: 'gameover' });
      expect(unknown.statusCode).toBe(404);
      const malformed = await finishRun(h.app, token, 'not-a-uuid', { score: 0, eraReached: 1, outcome: 'gameover' });
      expect(malformed.statusCode).toBe(400);
    });

    it('finishes a run only once', async () => {
      const { token } = await createPlayer(h.app);
      const runId = await startRun(h.app, token);
      h.advance(20_000);
      expect((await finishRun(h.app, token, runId, { score: 100, eraReached: 1, outcome: 'gameover' })).statusCode).toBe(200);
      const again = await finishRun(h.app, token, runId, { score: 2500, eraReached: 1, outcome: 'gameover' });
      expect(again.statusCode).toBe(409);
      expect(again.json()).toEqual({ error: 'conflict' });
    });

    it.each([
      ['more points than the era holds', { score: 2600, eraReached: 1, outcome: 'gameover' }, 60_000, 400],
      ['a score that is not a multiple of 100', { score: 150, eraReached: 1, outcome: 'gameover' }, 60_000, 400],
      ['a victory before the last era', { score: 5000, eraReached: 9, outcome: 'victory' }, 600_000, 400],
      ['a run faster than the eras allow', { score: 1000, eraReached: 5, outcome: 'gameover' }, 4 * MIN_ERA_MS - 1, 400],
      ['a run finished after six hours', { score: 100, eraReached: 1, outcome: 'gameover' }, 6 * 60 * 60 * 1000 + 1, 409]
    ])('rejects %s', async (_label, payload, elapsed, status) => {
      const { token } = await createPlayer(h.app);
      const runId = await startRun(h.app, token);
      h.advance(elapsed);
      const response = await finishRun(h.app, token, runId, payload);
      expect(response.statusCode).toBe(status);
      const rows = await h.database.db.execute<{ completed_at: Date | null }>(sql`select completed_at from runs`);
      expect(rows[0].completed_at).toBeNull();
    });

    it('continues a finished run, timing the continuation from the original start', async () => {
      const { token } = await createPlayer(h.app);
      const first = await startRun(h.app, token);
      h.advance(4 * MIN_ERA_MS);
      expect((await finishRun(h.app, token, first, { score: 4000, eraReached: 5, outcome: 'gameover' })).statusCode).toBe(200);

      const retry = await h.app.inject({ method: 'POST', url: '/api/runs', headers: auth(token), payload: { continues: first } });
      expect(retry.statusCode).toBe(201);
      h.advance(5_000);
      const finished = await finishRun(h.app, token, retry.json().runId, { score: 4500, eraReached: 5, outcome: 'gameover' });
      expect(finished.statusCode).toBe(200);
      expect(finished.json().run.durationMs).toBe(4 * MIN_ERA_MS + 5_000);
    });

    it("refuses to continue unfinished or other players' runs", async () => {
      const owner = await createPlayer(h.app, 'Happy Koala 1');
      const other = await createPlayer(h.app, 'Happy Koala 2');
      const open = await startRun(h.app, owner.token);
      const continueRun = (token: string, continues: string) => h.app.inject({ method: 'POST', url: '/api/runs', headers: auth(token), payload: { continues } });
      expect((await continueRun(owner.token, open)).statusCode).toBe(409);
      h.advance(20_000);
      await finishRun(h.app, owner.token, open, { score: 100, eraReached: 1, outcome: 'gameover' });
      expect((await continueRun(other.token, open)).statusCode).toBe(404);
      expect((await continueRun(owner.token, 'nope')).statusCode).toBe(400);
    });

    it('reports whether a run is a personal best', async () => {
      const { token } = await createPlayer(h.app);
      const results = [];
      for (const score of [1000, 500, 1500]) {
        const runId = await startRun(h.app, token);
        h.advance(20_000);
        results.push((await finishRun(h.app, token, runId, { score, eraReached: 1, outcome: 'gameover' })).json().personalBest);
      }
      expect(results).toEqual([true, false, true]);
    });
  });

  describe('leaderboard', () => {
    async function playerWithRuns(name: string, scores: number[], { unfinished = false, listed = true } = {}) {
      const { token } = await createPlayer(h.app, name);
      const joined = listed ? await joinLeaderboard(h.app, token) : null;
      expect(joined?.statusCode ?? 200).toBe(200);
      for (const score of scores) {
        const runId = await startRun(h.app, token);
        h.advance(30_000);
        await finishRun(h.app, token, runId, { score, eraReached: 2, outcome: 'gameover' });
      }
      if (unfinished) await startRun(h.app, token);
      return token;
    }

    it("ranks each listed player's best finished run, without player ids", async () => {
      await playerWithRuns('Brave Otter 1', [800, 2000]);
      await playerWithRuns('Clever Fox 2', [3000]);
      await playerWithRuns('Sunny Owl 3', [500], { unfinished: true });
      await playerWithRuns('Quick Lynx 4', [5000], { listed: false });
      await createPlayer(h.app, 'Merry Moose 5');
      const response = await h.app.inject({ method: 'GET', url: '/api/leaderboard' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=15');
      const { entries } = response.json<{ entries: Record<string, unknown>[] }>();
      expect(entries.map(e => [e.rank, e.displayName, e.score])).toEqual([[1, 'Clever Fox 2', 3000], [2, 'Brave Otter 1', 2000], [3, 'Sunny Owl 3', 500]]);
      expect(Object.keys(entries[0]).sort()).toEqual(['displayName', 'eraReached', 'finishedAt', 'outcome', 'rank', 'score']);
    });

    it('applies and validates the limit', async () => {
      await playerWithRuns('Brave Otter 1', [100]);
      await playerWithRuns('Clever Fox 2', [200]);
      const limited = await h.app.inject({ method: 'GET', url: '/api/leaderboard?limit=1' });
      expect(limited.json().entries).toHaveLength(1);
      const invalid = await h.app.inject({ method: 'GET', url: '/api/leaderboard?limit=500' });
      expect(invalid.statusCode).toBe(400);
    });
  });

  describe('joining the leaderboard', () => {
    it('lets a player pick a new name and opt in, returning their rank', async () => {
      const rival = await createPlayer(h.app, 'Clever Fox 2');
      await joinLeaderboard(h.app, rival.token);
      for (const score of [2000]) {
        const runId = await startRun(h.app, rival.token);
        h.advance(30_000);
        await finishRun(h.app, rival.token, runId, { score, eraReached: 1, outcome: 'gameover' });
      }

      const { token } = await createPlayer(h.app);
      const runId = await startRun(h.app, token);
      h.advance(30_000);
      const finished = await finishRun(h.app, token, runId, { score: 1500, eraReached: 1, outcome: 'gameover' });
      expect(finished.json().rank).toBeNull();

      const joined = await joinLeaderboard(h.app, token, { displayName: 'Turbo Panda 42', listed: true });
      expect(joined.statusCode).toBe(200);
      expect(joined.json()).toEqual({ player: expect.objectContaining({ displayName: 'Turbo Panda 42', listed: true }), rank: 2 });
      const board = (await h.app.inject({ method: 'GET', url: '/api/leaderboard' })).json<{ entries: { displayName: string; rank: number }[] }>();
      expect(board.entries.map(e => [e.rank, e.displayName])).toEqual([[1, 'Clever Fox 2'], [2, 'Turbo Panda 42']]);
    });

    it('returns the rank after finishing a run once listed, breaking ties by finish time', async () => {
      const first = await createPlayer(h.app, 'Clever Fox 2');
      await joinLeaderboard(h.app, first.token);
      const firstRun = await startRun(h.app, first.token);
      h.advance(30_000);
      await finishRun(h.app, first.token, firstRun, { score: 1000, eraReached: 1, outcome: 'gameover' });

      const second = await createPlayer(h.app, 'Sunny Owl 3');
      await joinLeaderboard(h.app, second.token);
      const tieRun = await startRun(h.app, second.token);
      h.advance(30_000);
      expect((await finishRun(h.app, second.token, tieRun, { score: 1000, eraReached: 1, outcome: 'gameover' })).json().rank).toBe(2);
      const winRun = await startRun(h.app, second.token);
      h.advance(30_000);
      expect((await finishRun(h.app, second.token, winRun, { score: 1100, eraReached: 1, outcome: 'gameover' })).json().rank).toBe(1);
    });

    it('requires a token and a valid change', async () => {
      const anonymous = await h.app.inject({ method: 'PATCH', url: '/api/players/me', payload: { listed: true } });
      expect(anonymous.statusCode).toBe(401);
      const { token } = await createPlayer(h.app);
      for (const payload of [{}, { listed: false }, { displayName: 'Ada' }, { listed: true, isAdmin: true }]) {
        const response = await joinLeaderboard(h.app, token, payload);
        expect(response.statusCode).toBe(400);
        expect(response.json()).toEqual({ error: 'invalid_request' });
      }
    });

    it('allows PATCH from the web origin in CORS preflight', async () => {
      const preflight = await h.app.inject({
        method: 'OPTIONS', url: '/api/players/me',
        headers: { origin: ORIGIN, 'access-control-request-method': 'PATCH', 'access-control-request-headers': 'authorization,content-type' }
      });
      expect(String(preflight.headers['access-control-allow-methods'])).toContain('PATCH');
    });
  });

  describe('abuse controls and headers', () => {
    it('rate limits player creation', async () => {
      const statuses = [];
      for (let i = 0; i < 6; i++) statuses.push((await h.app.inject({ method: 'POST', url: '/api/players', payload: { displayName: `Lucky Yak ${i + 1}` } })).statusCode);
      expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
      const limited = await h.app.inject({ method: 'POST', url: '/api/players', payload: { displayName: 'Lucky Yak 9' } });
      expect(limited.json()).toEqual({ error: 'rate_limited' });
    });

    it('allows only the configured web origin', async () => {
      const preflight = (origin: string) => h.app.inject({
        method: 'OPTIONS', url: '/api/runs',
        headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization,content-type' }
      });
      const allowed = await preflight(ORIGIN);
      expect(allowed.headers['access-control-allow-origin']).toBe(ORIGIN);
      expect(String(allowed.headers['access-control-allow-headers'])).toContain('Authorization');
      const denied = await preflight('https://evil.example');
      expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('marks responses as uncacheable and nosniff, and hides unknown routes', async () => {
      const { token } = await createPlayer(h.app);
      const me = await h.app.inject({ method: 'GET', url: '/api/players/me', headers: auth(token) });
      expect(me.headers['cache-control']).toBe('no-store');
      expect(me.headers['x-content-type-options']).toBe('nosniff');
      const missing = await h.app.inject({ method: 'GET', url: '/api/admin' });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: 'not_found' });
    });
  });
});

describe('when the database is down', () => {
  let app: App;
  beforeEach(async () => {
    // Nothing listens on port 1, so every query fails to connect.
    app = await buildApp({ database: createDatabase('postgres://nobody:nothing@127.0.0.1:1/down_test'), webOrigin: ORIGIN, logger: false });
  });
  afterEach(async () => { await app.close(); });

  it('reports not ready and returns generic 503s without leaking details', async () => {
    const ready = await app.inject({ method: 'GET', url: '/api/health/ready' });
    expect(ready.statusCode).toBe(503);
    const create = await app.inject({ method: 'POST', url: '/api/players', payload: { displayName: 'Brave Otter 1' } });
    expect(create.statusCode).toBe(503);
    expect(create.json()).toEqual({ error: 'unavailable' });
    const leaderboard = await app.inject({ method: 'GET', url: '/api/leaderboard' });
    expect(leaderboard.statusCode).toBe(503);
    expect(leaderboard.body).not.toMatch(/ECONN|127\.0\.0\.1|postgres/i);
  });

  it('still answers liveness checks', async () => {
    const live = await app.inject({ method: 'GET', url: '/api/health' });
    expect(live.statusCode).toBe(200);
  });
});
