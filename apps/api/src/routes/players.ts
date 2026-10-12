import type { CreatePlayerResponse, PlayerMeResponse } from '@chronokid/shared';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createToken, hashToken, requirePlayer } from '../auth.js';
import type { Db } from '../db/index.js';
import { players, runs } from '../db/schema.js';
import { createPlayerBody } from '../validation.js';

export function playerRoutes(app: FastifyInstance, db: Db): void {
  // Creating identities is the easiest thing to abuse, so it gets the strictest limit.
  app.post('/api/players', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { displayName } = createPlayerBody.parse(request.body);
    const token = createToken();
    const [player] = await db
      .insert(players)
      .values({ displayName, tokenHash: hashToken(token) })
      .returning({ id: players.id, displayName: players.displayName });
    const response: CreatePlayerResponse = { player, token };
    return reply.code(201).send(response);
  });

  app.get('/api/players/me', async request => {
    const player = await requirePlayer(db, request);
    const [best] = await db
      .select({ score: runs.score, eraReached: runs.eraReached, outcome: runs.outcome })
      .from(runs)
      .where(and(eq(runs.playerId, player.id), isNotNull(runs.completedAt)))
      .orderBy(desc(runs.score), asc(runs.completedAt))
      .limit(1);
    const response: PlayerMeResponse = {
      player,
      best: best?.outcome ? { score: best.score, eraReached: best.eraReached, outcome: best.outcome } : null
    };
    return response;
  });
}
