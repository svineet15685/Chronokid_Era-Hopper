import { sql } from 'drizzle-orm';
import { char, check, index, integer, pgEnum, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 24 }).notNull(),
  /** SHA-256 (hex) of the player's bearer token; the token itself is never stored. */
  tokenHash: char('token_hash', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, t => [
  check('players_display_name_length', sql`char_length(${t.displayName}) between 1 and 24`)
]);

export const runOutcome = pgEnum('run_outcome', ['gameover', 'victory']);

export const runs = pgTable('runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  score: integer('score').default(0).notNull(),
  eraReached: integer('era_reached').default(1).notNull(),
  /** Measured by the server when the run finishes; null while the run is in progress. */
  durationMs: integer('duration_ms'),
  outcome: runOutcome('outcome'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  /** When the run finished; null while it is in progress. */
  completedAt: timestamp('completed_at', { withTimezone: true })
}, t => [
  check('runs_score_nonnegative', sql`${t.score} >= 0`),
  check('runs_era_reached_range', sql`${t.eraReached} between 1 and 10`),
  check('runs_duration_nonnegative', sql`${t.durationMs} is null or ${t.durationMs} >= 0`),
  check('runs_finished_consistently', sql`(${t.completedAt} is null) = (${t.outcome} is null)`),
  index('runs_player_id_idx').on(t.playerId),
  // Serves the leaderboard: each player's best finished run.
  index('runs_player_best_idx').on(t.playerId, t.score.desc()).where(sql`${t.completedAt} is not null`)
]);
