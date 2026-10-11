import cors from '@fastify/cors';
import Fastify from 'fastify';
import { sql } from 'drizzle-orm';
import type { ApiHealth, ApiReadiness } from '@chronokid/shared';
import { config } from './config.js';
import { db, pool } from './db/index.js';

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: config.WEB_ORIGIN });

  app.get<{ Reply: ApiHealth }>('/api/health', async () => ({ status: 'ok' }));

  app.get<{ Reply: ApiReadiness }>('/api/health/ready', async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: 'ready' };
    } catch {
      return reply.code(503).send({ status: 'not_ready' });
    }
  });

  app.addHook('onClose', async () => {
    await pool.end({ timeout: 5 });
  });

  return app;
}