// Per-device progress: which eras the player has reached and their best star rating in each.
// Used by the era map; never sent to the server.
import { ERAS } from './game/config';

const STORAGE_KEY = 'chronokid.progress';

export interface Progress {
  /** Highest era index the player has reached (0 = only the first era). */
  reached: number;
  /** Best stars per era (0 = not yet cleared). */
  stars: number[];
}

export interface ProgressStore {
  load(): Progress;
  save(progress: Progress): void;
}

const empty = (): Progress => ({ reached: 0, stars: ERAS.map(() => 0) });

/** Accepts only well-formed saved data; anything else starts fresh. */
export function sanitizeProgress(value: unknown): Progress {
  const fresh = empty();
  if (typeof value !== 'object' || value === null) return fresh;
  const { reached, stars } = value as Partial<Progress>;
  if (Number.isInteger(reached)) fresh.reached = Math.min(Math.max(reached as number, 0), ERAS.length - 1);
  if (Array.isArray(stars)) fresh.stars = fresh.stars.map((_, i) => (Number.isInteger(stars[i]) ? Math.min(Math.max(stars[i], 0), 3) : 0));
  return fresh;
}

export const browserProgressStore: ProgressStore = {
  load() {
    try {
      return sanitizeProgress(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
      return empty();
    }
  },
  save(progress) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      /* not persisted */
    }
  }
};

export class ProgressTracker {
  private progress: Progress;

  constructor(private readonly store: ProgressStore = browserProgressStore) {
    this.progress = store.load();
  }

  get current(): Readonly<Progress> {
    return this.progress;
  }

  isUnlocked(eraIndex: number): boolean {
    return eraIndex <= this.progress.reached;
  }

  /** Marks an era as reached, so it appears on the era map. */
  reach(eraIndex: number): void {
    if (eraIndex <= this.progress.reached) return;
    this.progress = { ...this.progress, reached: Math.min(eraIndex, ERAS.length - 1) };
    this.store.save(this.progress);
  }

  /** Records a clear; returns true when it beats the previous best stars for that era. */
  recordClear(eraIndex: number, stars: number): boolean {
    const best = this.progress.stars[eraIndex] ?? 0;
    const improved = stars > best;
    const reached = Math.min(Math.max(this.progress.reached, eraIndex + 1), ERAS.length - 1);
    if (!improved && reached === this.progress.reached) return false;
    this.progress = { reached, stars: this.progress.stars.map((s, i) => (i === eraIndex ? Math.max(s, stars) : s)) };
    this.store.save(this.progress);
    return improved;
  }
}
