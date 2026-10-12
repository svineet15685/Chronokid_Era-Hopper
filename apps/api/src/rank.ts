import { and, asc, countDistinct, desc, eq, gt, isNotNull, lt, ne, or } from 'drizzle-orm';
import type { Db } from './db/index.js';
import { players, runs } from './db/schema.js';

/**
 * The player's position on the leaderboard, using the same order: best score first, earlier finish
 * breaking ties. Null when the player is unlisted or has not finished a run.
 */
export async function leaderboardRank(db: Db, playerId: string, listed: boolean): Promise<number | null> {
  if (!listed) return null;
  const [best] = await db
    .select({ score: runs.score, completedAt: runs.completedAt })
    .from(runs)
    .where(and(eq(runs.playerId, playerId), isNotNull(runs.completedAt)))
    .orderBy(desc(runs.score), asc(runs.completedAt))
    .limit(1);
  if (!best?.completedAt) return null;
  const [ahead] = await db
    .select({ count: countDistinct(runs.playerId) })
    .from(runs)
    .innerJoin(players, eq(players.id, runs.playerId))
    .where(and(
      eq(players.listed, true),
      isNotNull(runs.completedAt),
      ne(runs.playerId, playerId),
      or(gt(runs.score, best.score), and(eq(runs.score, best.score), lt(runs.completedAt, best.completedAt)))
    ));
  return (ahead?.count ?? 0) + 1;
}
