// Contracts shared by the browser and the API. Types and plain constants only: no secrets or server logic.

export { NAME_ADJECTIVES, NAME_ANIMALS, generateDisplayName, isAllowedDisplayName } from './names.js';

export interface ApiHealth {
  status: 'ok';
}

export interface ApiReadiness {
  status: 'ready' | 'not_ready';
}

/** Game rules the API uses to sanity-check submitted runs. The web game must match these. */
export const GAME_RULES = {
  eraCount: 10,
  pickupsPerEra: 25,
  pickupPoints: 100
} as const;

export const DISPLAY_NAME_MAX = 24;

export type RunOutcome = 'gameover' | 'victory';

export interface PlayerProfile {
  id: string;
  displayName: string;
  /** Whether the player chose to appear on the public leaderboard. */
  listed: boolean;
}

/** POST /api/players */
export interface CreatePlayerRequest {
  displayName: string;
}
export interface CreatePlayerResponse {
  player: PlayerProfile;
  /** Secret for `Authorization: Bearer <token>`. Shown once; the server keeps only a hash. */
  token: string;
}

/** PATCH /api/players/me: rename and/or opt in to the leaderboard. Opting out is not offered yet. */
export interface UpdatePlayerRequest {
  displayName?: string;
  listed?: true;
}
export interface UpdatePlayerResponse {
  player: PlayerProfile;
  /** Leaderboard position of the player's best run, when listed and they have finished a run. */
  rank: number | null;
}

/** GET /api/players/me */
export interface PlayerMeResponse {
  player: PlayerProfile;
  best: { score: number; eraReached: number; outcome: RunOutcome } | null;
}

/** POST /api/runs (body optional) */
export interface StartRunRequest {
  /**
   * A finished run of yours that this one continues ("Retry" after a game over keeps the score).
   * The new run is timed from the original start, so duration checks still hold.
   */
  continues?: string;
}
export interface StartRunResponse {
  runId: string;
  startedAt: string;
}

/** POST /api/runs/:runId/finish */
export interface FinishRunRequest {
  score: number;
  /** 1-based era the run ended in. */
  eraReached: number;
  outcome: RunOutcome;
}
export interface FinishRunResponse {
  run: { id: string; score: number; eraReached: number; outcome: RunOutcome; durationMs: number };
  personalBest: boolean;
  /** Leaderboard position of the player's best run, when listed. */
  rank: number | null;
}

/** GET /api/leaderboard */
export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  eraReached: number;
  outcome: RunOutcome;
  finishedAt: string;
}
export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

export type ApiErrorCode = 'invalid_request' | 'unauthorized' | 'not_found' | 'conflict' | 'rate_limited' | 'unavailable' | 'internal';
export interface ApiError {
  error: ApiErrorCode;
}
