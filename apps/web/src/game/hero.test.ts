import { describe, expect, it } from 'vitest';
import { OUTFITS, drawHero, isOutfitId, newlyUnlocked, outfitUnlocked } from './hero';

/** A stand-in 2D context that records draw calls, so every outfit can be drawn without a browser. */
function recordingContext() {
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_target, prop: string) => (['fill', 'fillRect', 'stroke'].includes(prop) ? () => calls.push(prop) : () => undefined),
    set: () => true
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe('outfits', () => {
  it('starts with Classic for free and ends with the crown at every star', () => {
    expect(OUTFITS[0]).toEqual({ id: 'classic', name: 'Classic', stars: 0 });
    expect(OUTFITS.at(-1)).toMatchObject({ id: 'crown', stars: 30 });
    for (let i = 1; i < OUTFITS.length; i++) expect(OUTFITS[i].stars).toBeGreaterThan(OUTFITS[i - 1].stars);
    expect(new Set(OUTFITS.map(o => o.id)).size).toBe(OUTFITS.length);
  });

  it('unlocks by total stars and reports what a clear newly unlocked', () => {
    const viking = OUTFITS.find(o => o.id === 'viking');
    if (!viking) throw new Error('missing viking');
    expect(outfitUnlocked(viking, 8)).toBe(false);
    expect(outfitUnlocked(viking, 9)).toBe(true);
    expect(newlyUnlocked(8, 11).map(o => o.id)).toEqual(['viking']);
    expect(newlyUnlocked(2, 6).map(o => o.id)).toEqual(['caveman', 'pharaoh']);
    expect(newlyUnlocked(9, 9)).toEqual([]);
  });

  it('validates stored outfit ids', () => {
    expect(isOutfitId('pumpkin')).toBe(true);
    expect(isOutfitId('dragon')).toBe(false);
    expect(isOutfitId(null)).toBe(false);
  });

  it.each(OUTFITS.map(o => o.id))('draws the %s look, standing and dancing', id => {
    for (const armsUp of [false, true]) {
      const { ctx, calls } = recordingContext();
      drawHero(ctx, 100, { outfit: id, armsUp });
      expect(calls.length).toBeGreaterThan(8);
    }
  });
});
