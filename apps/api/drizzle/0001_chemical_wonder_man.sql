CREATE TYPE "public"."run_outcome" AS ENUM('gameover', 'victory');--> statement-breakpoint
ALTER TABLE "runs" ALTER COLUMN "duration_ms" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "token_hash" char(64) NOT NULL;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "outcome" "run_outcome";--> statement-breakpoint
CREATE INDEX "runs_player_id_idx" ON "runs" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "runs_player_best_idx" ON "runs" USING btree ("player_id","score" DESC NULLS LAST) WHERE "runs"."completed_at" is not null;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_token_hash_unique" UNIQUE("token_hash");--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_display_name_length" CHECK (char_length("players"."display_name") between 1 and 24);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_score_nonnegative" CHECK ("runs"."score" >= 0);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_era_reached_range" CHECK ("runs"."era_reached" between 1 and 10);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_duration_nonnegative" CHECK ("runs"."duration_ms" is null or "runs"."duration_ms" >= 0);--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_finished_consistently" CHECK (("runs"."completed_at" is null) = ("runs"."outcome" is null));