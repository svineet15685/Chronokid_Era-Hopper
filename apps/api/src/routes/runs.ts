import type { FinishRunResponse, StartRunResponse } from '@chronokid/shared';
import { and, eq, isNotNull, isNull, max } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requirePlayer } from '../auth.js';
import type { Db } from '../db/index.js';
import { runs } from '../db/schema.js';
import { ApiFailure } from '../errors.js';
import { checkRunPlausibility, finishRunBody, runIdParams } from '../validation.js';

const RUN_LIMIT = { rateLimit: { max: 30, timeWindow: '1 minute' } };

export function runRoutes(app: FastifyInstance, db: Db, now: () => Date): void {
  app.post('/api/runs', { config: RUN_LIMIT }, async (request, reply) => {
    const player = await requirePlayer(db, request);
    const startedAt = now();
    const [run] = await db.insert(runs).values({ playerId: player.id, startedAt }).returning({ id: runs.id });
    const response: StartRunResponse = { runId: run.id, startedAt: startedAt.toISOString() };
    return reply.code(201).send(response);
  });

  app.post('/api/runs/:runId/finish', { config: RUN_LIMIT }, async request => {
    const player = await requirePlayer(db, request);
    const { runId } = runIdParams.parse(request.params);
    const body = finishRunBody.parse(request.body);

    // Ownership is part of the lookup: another player's run is indistinguishable from a missing one.
    const owned = and(eq(runs.id, runId), eq(runs.playerId, player.id));
    const [run] = await db.select({ startedAt: runs.startedAt, completedAt: runs.completedAt }).from(runs).where(owned).limit(1);
    if (!run) throw new ApiFailure(404, 'not_found');
    if (run.completedAt) throw new ApiFailure(409, 'conflict');

    const finishedAt = now();
    const durationMs = Math.max(0, finishedAt.getTime() - run.startedAt.getTime());
    const problem = checkRunPlausibility(body, durationMs);
    if (problem) {
      request.log.info({ problem, durationMs }, 'rejected implausible run');
      throw problem === 'expired' ? new ApiFailure(409, 'conflict') : new ApiFailure(400, 'invalid_request');
    }

    const [previous] = await db
      .select({ best: max(runs.score) })
      .from(runs)
      .where(and(eq(runs.playerId, player.id), isNotNull(runs.completedAt)));
    // The `completed_at is null` guard makes finishing atomic if two requests race.
    const updated = await db
      .update(runs)
      .set({ score: body.score, eraReached: body.eraReached, outcome: body.outcome, durationMs, completedAt: finishedAt })
      .where(and(owned, isNull(runs.completedAt)))
      .returning({ id: runs.id });
    if (updated.length === 0) throw new ApiFailure(409, 'conflict');

    const response: FinishRunResponse = {
      run: { id: runId, score: body.score, eraReached: body.eraReached, outcome: body.outcome, durationMs },
      personalBest: previous?.best == null || body.score > previous.best
    };
    return response;
  });
}
