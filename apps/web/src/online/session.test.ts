import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineSession, type Identity, type IdentityStore } from './session';

interface Call { method: string; path: string; body: unknown; auth: string | null }

/** A fake API: records calls and answers from a route table. */
function fakeApi(routes: Record<string, (call: Call) => Response | Promise<Response>>) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', async (path: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    const call: Call = { method: init.method ?? 'GET', path, body: init.body ? JSON.parse(String(init.body)) : undefined, auth: headers.authorization ?? null };
    calls.push(call);
    const route = Object.entries(routes).find(([key]) => new RegExp(`^${key}$`).test(`${call.method} ${call.path}`));
    if (!route) throw new TypeError('network error');
    return route[1](call);
  });
  return calls;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function memoryStore(initial: Identity | null = null): IdentityStore & { value: Identity | null } {
  return { value: initial, load() { return this.value; }, save(identity) { this.value = identity; } };
}

const TOKEN = 'T'.repeat(43);
const happyRoutes = {
  'POST /api/players': (call: Call) => json(201, { player: { id: 'p1', displayName: (call.body as { displayName: string }).displayName, listed: false }, token: TOKEN }),
  'POST /api/runs': () => json(201, { runId: `run-${Math.random()}`, startedAt: new Date().toISOString() }),
  'POST /api/runs/[^/]+/finish': () => json(200, { run: {}, personalBest: true, rank: null }),
  'PATCH /api/players/me': (call: Call) => json(200, { player: { id: 'p1', displayName: (call.body as { displayName: string }).displayName, listed: true }, rank: 4 })
};
const result = { score: 300, eraReached: 1, outcome: 'gameover' as const };

afterEach(() => vi.unstubAllGlobals());

describe('OnlineSession', () => {
  it('creates an unlisted guest once, registers runs, and saves results', async () => {
    const calls = fakeApi(happyRoutes);
    const store = memoryStore();
    const session = new OnlineSession(store);
    session.startRun();
    expect(await session.finishRun(result)).toEqual({ kind: 'saved', personalBest: true, rank: null });
    session.startRun();
    await session.finishRun(result);

    expect(calls.filter(c => c.path === '/api/players')).toHaveLength(1);
    expect(store.value).toMatchObject({ token: TOKEN, listed: false, declined: false });
    expect(calls.filter(c => c.path.endsWith('/finish')).every(c => c.auth === `Bearer ${TOKEN}`)).toBe(true);
    expect(session.shouldOffer).toBe(true);
  });

  it('continues the last finished run on retry', async () => {
    const calls = fakeApi(happyRoutes);
    const session = new OnlineSession(memoryStore());
    session.startRun();
    await session.finishRun(result);
    const finishedRun = calls.find(c => c.path.endsWith('/finish'))?.path.split('/')[3];
    session.continueRun();
    await session.finishRun(result);
    const starts = calls.filter(c => c.method === 'POST' && c.path === '/api/runs');
    expect(starts.map(c => c.body)).toEqual([{}, { continues: finishedRun }]);
  });

  it('reports unsaved when offline, without throwing', async () => {
    fakeApi({});
    const session = new OnlineSession(memoryStore());
    session.startRun();
    expect(await session.finishRun(result)).toEqual({ kind: 'unsaved' });
    expect(await session.leaderboard()).toBeNull();
    expect(await session.join('Brave Otter 1')).toBeNull();
  });

  it('reports unsaved when the server fails, and rejected when it refuses the result', async () => {
    fakeApi({ ...happyRoutes, 'POST /api/runs/[^/]+/finish': () => json(503, { error: 'unavailable' }) });
    const down = new OnlineSession(memoryStore());
    down.startRun();
    expect(await down.finishRun(result)).toEqual({ kind: 'unsaved' });

    fakeApi({ ...happyRoutes, 'POST /api/runs/[^/]+/finish': () => json(400, { error: 'invalid_request' }) });
    const refused = new OnlineSession(memoryStore());
    refused.startRun();
    expect(await refused.finishRun(result)).toEqual({ kind: 'rejected' });
  });

  it('forgets an identity the server no longer accepts', async () => {
    fakeApi({ ...happyRoutes, 'POST /api/runs': () => json(401, { error: 'unauthorized' }) });
    const store = memoryStore({ token: TOKEN, displayName: 'Brave Otter 1', listed: true, declined: false });
    const session = new OnlineSession(store);
    session.startRun();
    expect(await session.finishRun(result)).toEqual({ kind: 'unsaved' });
    expect(store.value).toBeNull();
    expect(session.player).toBeNull();
  });

  it('joins the leaderboard under the chosen name', async () => {
    const calls = fakeApi(happyRoutes);
    const store = memoryStore();
    const session = new OnlineSession(store);
    expect(await session.join('Turbo Panda 42')).toEqual({ rank: 4 });
    expect(calls.find(c => c.method === 'PATCH')?.body).toEqual({ displayName: 'Turbo Panda 42', listed: true });
    expect(store.value).toMatchObject({ displayName: 'Turbo Panda 42', listed: true });
    expect(session.shouldOffer).toBe(false);
  });

  it('stops offering the leaderboard after "No thanks"', async () => {
    fakeApi(happyRoutes);
    const store = memoryStore();
    const session = new OnlineSession(store);
    session.startRun();
    await session.finishRun(result);
    session.decline();
    expect(session.shouldOffer).toBe(false);
    expect(store.value?.declined).toBe(true);
  });

  it('reports unsaved for a second finish of the same run', async () => {
    fakeApi(happyRoutes);
    const session = new OnlineSession(memoryStore());
    session.startRun();
    await session.finishRun(result);
    expect(await session.finishRun(result)).toEqual({ kind: 'unsaved' });
  });
});
