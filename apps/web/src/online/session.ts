// Connects a play session to the API without ever blocking or breaking local play.
// A guest identity is created quietly on first play so the server can time runs from their start;
// the player stays off the public leaderboard until they opt in.
import { generateDisplayName, type FinishRunRequest, type LeaderboardEntry } from '@chronokid/shared';
import { ApiRejected, api } from './api';

const STORAGE_KEY = 'chronokid.identity';

export interface Identity {
  token: string;
  displayName: string;
  listed: boolean;
  /** The player said "No thanks" to the leaderboard prompt; do not ask again after each game. */
  declined: boolean;
}

export type FinishResult =
  | { kind: 'saved'; personalBest: boolean; rank: number | null }
  /** The server refused the result (for example, implausible); the game carries on. */
  | { kind: 'rejected' }
  /** Offline, server down, or no run was registered. */
  | { kind: 'unsaved' };

export interface IdentityStore {
  load(): Identity | null;
  save(identity: Identity | null): void;
}

/** Browser storage can be unavailable (private mode, blocked storage); fall back to memory. */
export const browserIdentityStore: IdentityStore = {
  load() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Identity> | null;
      if (typeof value?.token !== 'string' || typeof value.displayName !== 'string') return null;
      return { token: value.token, displayName: value.displayName, listed: value.listed === true, declined: value.declined === true };
    } catch {
      return null;
    }
  },
  save(identity) {
    try {
      if (identity) localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* not persisted; the identity lives for this page only */
    }
  }
};

export class OnlineSession {
  private identity: Identity | null;
  private run: Promise<string | null> | null = null;
  /** The last run the server accepted, which a "Retry" can continue. */
  private lastFinishedRun: string | null = null;
  private creating: Promise<Identity | null> | null = null;

  constructor(private readonly store: IdentityStore = browserIdentityStore) {
    this.identity = store.load();
  }

  get player(): Readonly<Identity> | null {
    return this.identity;
  }

  /** Offer the leaderboard after a saved run, unless the player already joined or said no. */
  get shouldOffer(): boolean {
    return this.identity !== null && !this.identity.listed && !this.identity.declined;
  }

  /** Registers a new run in the background. Call when a fresh game starts. */
  startRun(): void {
    this.lastFinishedRun = null;
    this.register();
  }

  /**
   * Registers a run that continues the last finished one, for "Retry" after a game over: the score
   * carries on, so the server times it from the original start.
   */
  continueRun(): void {
    this.register(this.lastFinishedRun ?? undefined);
  }

  private register(continues?: string): void {
    this.run = this.ensureIdentity().then(async identity => {
      if (!identity) return null;
      try {
        return (await api.startRun(identity.token, continues ? { continues } : {})).runId;
      } catch (error) {
        this.forgetIfUnauthorized(error);
        return null;
      }
    });
  }

  /** Submits the current run once; later calls for the same run report it as unsaved. */
  async finishRun(result: FinishRunRequest): Promise<FinishResult> {
    const pending = this.run;
    this.run = null;
    const runId = pending ? await pending : null;
    const identity = this.identity;
    if (!runId || !identity) return { kind: 'unsaved' };
    try {
      const response = await api.finishRun(identity.token, runId, result);
      this.lastFinishedRun = runId;
      return { kind: 'saved', personalBest: response.personalBest, rank: response.rank };
    } catch (error) {
      this.forgetIfUnauthorized(error);
      return error instanceof ApiRejected ? { kind: 'rejected' } : { kind: 'unsaved' };
    }
  }

  /** A fresh suggestion for the name picker. */
  suggestName(): string {
    return generateDisplayName();
  }

  /** Opts in to the leaderboard under `displayName`. Returns the rank, or null if it could not be saved. */
  async join(displayName: string): Promise<{ rank: number | null } | null> {
    const identity = await this.ensureIdentity();
    if (!identity) return null;
    try {
      const response = await api.updatePlayer(identity.token, { displayName, listed: true });
      this.update({ displayName: response.player.displayName, listed: response.player.listed });
      return { rank: response.rank };
    } catch (error) {
      this.forgetIfUnauthorized(error);
      return null;
    }
  }

  decline(): void {
    this.update({ declined: true });
  }

  /** Top entries, or null when the leaderboard cannot be loaded. */
  async leaderboard(limit = 10): Promise<LeaderboardEntry[] | null> {
    try {
      return (await api.leaderboard(limit)).entries;
    } catch {
      return null;
    }
  }

  private ensureIdentity(): Promise<Identity | null> {
    if (this.identity) return Promise.resolve(this.identity);
    this.creating ??= api.createPlayer(generateDisplayName()).then(
      ({ player, token }) => {
        this.identity = { token, displayName: player.displayName, listed: player.listed, declined: false };
        this.store.save(this.identity);
        return this.identity;
      },
      () => null
    ).finally(() => { this.creating = null; });
    return this.creating;
  }

  private update(changes: Partial<Identity>): void {
    if (!this.identity) return;
    this.identity = { ...this.identity, ...changes };
    this.store.save(this.identity);
  }

  /** A rejected token means the server no longer knows this player; start fresh next time. */
  private forgetIfUnauthorized(error: unknown): void {
    if (error instanceof ApiRejected && error.status === 401) {
      this.identity = null;
      this.store.save(null);
    }
  }
}
