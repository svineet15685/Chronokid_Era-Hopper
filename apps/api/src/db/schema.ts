import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: varchar('display_name', { length: 24 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
});

export const runs = pgTable('runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }).notNull(),
  score: integer('score').default(0).notNull(),
  eraReached: integer('era_reached').default(1).notNull(),
  durationMs: integer('duration_ms').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true })
});