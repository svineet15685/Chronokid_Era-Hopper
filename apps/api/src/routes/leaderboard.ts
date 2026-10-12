import type { LeaderboardResponse } from '@chronokid/shared';
import { asc, desc, eq, isNotNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import { players, runs } from '../db/schema.js';
import { leaderboardQuery } from '../validation.js';

export function leaderboardRoutes(app: FastifyInstance, db: Db): void {
  // Public and casual: each player's best finished run. Player IDs are not exposed.
  app.get('/api/leaderboard', async (request, reply) => {
    const { limit } = leaderboardQuery.parse(request.query);
    const best = db
      .selectDistinctOn([runs.playerId], {
        displayName: players.displayName,
        score: runs.score,
        eraReached: runs.eraReached,
        outcome: runs.outcome,
        completedAt: runs.completedAt
      })
      .from(runs)
      .innerJoin(players, eq(players.id, runs.playerId))
      .where(isNotNull(runs.completedAt))
      .orderBy(runs.playerId, desc(runs.score), asc(runs.completedAt))
      .as('best');
    const rows = await db.select().from(best).orderBy(desc(best.score), asc(best.completedAt)).limit(limit);

    const response: LeaderboardResponse = {
      entries: rows.flatMap((row, i) => row.outcome && row.completedAt
        ? [{ rank: i + 1, displayName: row.displayName, score: row.score, eraReached: row.eraReached, outcome: row.outcome, finishedAt: row.completedAt.toISOString() }]
        : [])
    };
    reply.header('cache-control', 'public, max-age=15');
    return response;
  });
}
