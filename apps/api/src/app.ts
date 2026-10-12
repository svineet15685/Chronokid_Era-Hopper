import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { sql } from 'drizzle-orm';
import type { ApiHealth, ApiReadiness } from '@chronokid/shared';
import type { Database } from './db/index.js';
import { registerErrorHandling } from './errors.js';
import { leaderboardRoutes } from './routes/leaderboard.js';
import { playerRoutes } from './routes/players.js';
import { runRoutes } from './routes/runs.js';

/** Requests per minute per client IP. */
export interface RateLimits {
  global: number;
  createPlayer: number;
  updatePlayer: number;
  runs: number;
}

export const DEFAULT_RATE_LIMITS: RateLimits = { global: 120, createPlayer: 5, updatePlayer: 10, runs: 30 };

/** The default limits multiplied by `scale` (used by automated tests that make many requests from one IP). */
export function scaleRateLimits(scale: number): RateLimits {
  const { global, createPlayer, updatePlayer, runs } = DEFAULT_RATE_LIMITS;
  return { global: global * scale, createPlayer: createPlayer * scale, updatePlayer: updatePlayer * scale, runs: runs * scale };
}

export interface AppOptions {
  database: Database;
  webOrigin: string;
  logger?: FastifyServerOptions['logger'];
  /** Only enable behind a trusted reverse proxy, or clients can spoof their IP for rate limiting. */
  trustProxy?: boolean;
  /** Clock used for run timing; injectable for tests. */
  now?: () => Date;
  rateLimits?: RateLimits;
}

export async function buildApp({ database, webOrigin, logger = true, trustProxy = false, now = () => new Date(), rateLimits = DEFAULT_RATE_LIMITS }: AppOptions) {
  const { db } = database;
  const app = Fastify({ logger, trustProxy, bodyLimit: 4096 });
  registerErrorHandling(app);

  // A list (not a bare string) makes other origins get no CORS headers at all.
  await app.register(cors, { origin: [webOrigin], methods: ['GET', 'POST', 'PATCH'], allowedHeaders: ['Content-Type', 'Authorization'], maxAge: 600 });
  await app.register(rateLimit, {
    global: true,
    max: rateLimits.global,
    timeWindow: '1 minute',
    // Thrown as an error with this status; the error handler turns it into { error: 'rate_limited' }.
    errorResponseBuilder: () => ({ statusCode: 429, error: 'rate_limited', message: 'rate limited' })
  });
  app.addHook('onSend', async (_request, reply) => {
    if (!reply.hasHeader('cache-control')) reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
  });

  app.get<{ Reply: ApiHealth }>('/api/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));

  app.get<{ Reply: ApiReadiness }>('/api/health/ready', { config: { rateLimit: false } }, async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  playerRoutes(app, db, rateLimits);
  runRoutes(app, db, now, rateLimits);
  leaderboardRoutes(app, db);

  app.addHook('onClose', async () => {
    await database.close();
  });

  return app;
}
