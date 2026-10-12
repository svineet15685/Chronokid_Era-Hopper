import type { CreatePlayerResponse, PlayerMeResponse, UpdatePlayerResponse } from '@chronokid/shared';
import { and, asc, desc, eq, isNotNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { createToken, hashToken, requirePlayer } from '../auth.js';
import type { Db } from '../db/index.js';
import { players, runs } from '../db/schema.js';
import { leaderboardRank } from '../rank.js';
import { createPlayerBody, updatePlayerBody } from '../validation.js';
import type { RateLimits } from '../app.js';

const profile = { id: players.id, displayName: players.displayName, listed: players.listed };

export function playerRoutes(app: FastifyInstance, db: Db, limits: RateLimits): void {
  // Creating identities is the easiest thing to abuse, so it gets the strictest limit.
  app.post('/api/players', { config: { rateLimit: { max: limits.createPlayer, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { displayName } = createPlayerBody.parse(request.body);
    const token = createToken();
    const [player] = await db.insert(players).values({ displayName, tokenHash: hashToken(token) }).returning(profile);
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

  app.patch('/api/players/me', { config: { rateLimit: { max: limits.updatePlayer, timeWindow: '1 minute' } } }, async request => {
    const current = await requirePlayer(db, request);
    const changes = updatePlayerBody.parse(request.body);
    const [player] = await db.update(players).set(changes).where(eq(players.id, current.id)).returning(profile);
    const response: UpdatePlayerResponse = { player, rank: await leaderboardRank(db, player.id, player.listed) };
    return response;
  });
}
