import { describe, expect, it } from 'vitest';
import { ProgressTracker, sanitizeProgress, totalStars, type Progress, type ProgressStore } from './progress';

function memoryStore(initial?: Progress): ProgressStore & { saved: Progress | null } {
  return {
    saved: null,
    load() { return sanitizeProgress(initial ?? null); },
    save(progress) { this.saved = progress; }
  };
}

describe('progress', () => {
  it('starts with only the first era unlocked and no stars', () => {
    const tracker = new ProgressTracker(memoryStore());
    expect(tracker.current.reached).toBe(0);
    expect(tracker.current.stars).toEqual(Array(10).fill(0));
    expect(tracker.isUnlocked(0)).toBe(true);
    expect(tracker.isUnlocked(1)).toBe(false);
  });

  it('unlocks the next era on a clear and keeps the best stars', () => {
    const store = memoryStore();
    const tracker = new ProgressTracker(store);
    expect(tracker.recordClear(0, 2)).toBe(true);
    expect(tracker.isUnlocked(1)).toBe(true);
    expect(tracker.recordClear(0, 1)).toBe(false);
    expect(tracker.current.stars[0]).toBe(2);
    expect(tracker.recordClear(0, 3)).toBe(true);
    expect(store.saved?.stars[0]).toBe(3);
  });

  it('unlocks eras reached during a run and never past the last era', () => {
    const tracker = new ProgressTracker(memoryStore());
    tracker.reach(4);
    expect(tracker.isUnlocked(4)).toBe(true);
    tracker.recordClear(9, 1);
    expect(tracker.current.reached).toBe(9);
  });

  it('totals the best stars across eras', () => {
    expect(totalStars({ reached: 3, stars: [3, 2, 1, 0, 0, 0, 0, 0, 0, 0] })).toBe(6);
  });

  it('ignores corrupted or tampered saved data', () => {
    expect(sanitizeProgress('nope')).toEqual({ reached: 0, stars: Array(10).fill(0) });
    expect(sanitizeProgress({ reached: 99, stars: [7, -1, 'x', 2] })).toEqual({ reached: 9, stars: [3, 0, 0, 2, 0, 0, 0, 0, 0, 0] });
  });
});
