import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createDatabase } from '../src/db/index.js';

// Serving the built game needs no database, so these run everywhere (the database URL points nowhere).
describe('serving the built game', () => {
  let dir: string;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'chronokid-static-'));
    await mkdir(join(dir, 'assets'));
    await writeFile(join(dir, 'index.html'), '<!doctype html><title>Chronokid</title>');
    await writeFile(join(dir, 'assets', 'index-abc123.js'), 'console.log("game")');
    app = await buildApp({ database: createDatabase('postgres://nobody:nothing@127.0.0.1:1/down_test'), webOrigin: 'http://localhost:5173', logger: false, staticDir: dir });
  });

  afterAll(async () => {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('serves the page with a strict content security policy and no long-term caching', async () => {
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('<title>Chronokid</title>');
    expect(page.headers['cache-control']).toBe('no-cache');
    const csp = String(page.headers['content-security-policy']);
    for (const directive of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'"]) expect(csp).toContain(directive);
    expect(csp).not.toContain('unsafe-inline');
    expect(page.headers).toMatchObject({ 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' });
  });

  it('caches hashed assets for a year', async () => {
    const asset = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('keeps API responses uncached and unknown paths as 404', async () => {
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    expect(health.json()).toEqual({ status: 'ok' });
    expect(health.headers['cache-control']).toBe('no-store');
    expect(health.headers['content-security-policy']).toBeDefined();
    const missing = await app.inject({ method: 'GET', url: '/secret.txt' });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: 'not_found' });
    const traversal = await app.inject({ method: 'GET', url: '/assets/../../package.json' });
    expect(traversal.statusCode).toBe(404);
  });
});
