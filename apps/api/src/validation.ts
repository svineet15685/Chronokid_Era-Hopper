// Request schemas and run plausibility rules. Pure functions, unit tested without a database.
// These checks reject impossible submissions; they are not anti-cheat. The game runs in the browser,
// so a determined player can still submit any plausible score (see SECURITY.md).
import { DISPLAY_NAME_MAX, GAME_RULES } from '@chronokid/shared';
import { z } from 'zod';

/** Letters (any language), digits, spaces, and a little punctuation. No emoji, symbols, or control characters. */
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} ._'-]*$/u;

export const displayNameSchema = z
  .string()
  .transform(name => name.normalize('NFKC').replace(/\s+/g, ' ').trim())
  .pipe(z.string().min(1).max(DISPLAY_NAME_MAX).regex(DISPLAY_NAME_PATTERN));

export const createPlayerBody = z.strictObject({ displayName: displayNameSchema });

export const runIdParams = z.strictObject({ runId: z.uuid() });

const MAX_SCORE = GAME_RULES.eraCount * GAME_RULES.pickupsPerEra * GAME_RULES.pickupPoints;

export const finishRunBody = z.strictObject({
  score: z.number().int().min(0).max(MAX_SCORE).multipleOf(GAME_RULES.pickupPoints),
  eraReached: z.number().int().min(1).max(GAME_RULES.eraCount),
  outcome: z.enum(['gameover', 'victory'])
});
export type FinishRunBody = z.infer<typeof finishRunBody>;

export const leaderboardQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

/** Fastest believable time to cross one era (3440 px at the top speed of 330 px/s is about 10.4 s). */
export const MIN_ERA_MS = 8_000;
/** Runs must be finished within this long of starting. */
export const MAX_RUN_MS = 6 * 60 * 60 * 1000;

export type Implausible = 'score_exceeds_eras' | 'victory_before_last_era' | 'too_fast' | 'expired';

/** Checks a finished run against what the game makes possible, using the server-measured duration. */
export function checkRunPlausibility(run: FinishRunBody, durationMs: number): Implausible | null {
  if (run.score > run.eraReached * GAME_RULES.pickupsPerEra * GAME_RULES.pickupPoints) return 'score_exceeds_eras';
  if (run.outcome === 'victory' && run.eraReached !== GAME_RULES.eraCount) return 'victory_before_last_era';
  const erasCrossed = run.outcome === 'victory' ? run.eraReached : run.eraReached - 1;
  if (durationMs < erasCrossed * MIN_ERA_MS) return 'too_fast';
  if (durationMs > MAX_RUN_MS) return 'expired';
  return null;
}
