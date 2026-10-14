import { describe, expect, it } from 'vitest';
import { drawBossAttacks, drawBossCreature } from './boss-art';
import { BOSS_DEFS, type BossKind, type Projectile } from './boss';

/** A stand-in 2D context that records draw calls, so every boss can be drawn without a browser. */
function recordingContext() {
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_target, prop: string) => (['fill', 'fillRect', 'stroke'].includes(prop) ? () => calls.push(prop) : () => undefined),
    set: () => true
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const thing = (delay = 0): Projectile => ({ x: 100, y: 300, w: 26, h: 18, vx: -300, vy: 0, delay });

describe('boss art', () => {
  it.each(Object.keys(BOSS_DEFS) as BossKind[])('draws the %s standing, roaring, tired, and its attacks', kind => {
    for (const pose of [{ tired: false, roaring: false }, { tired: false, roaring: true }, { tired: true, roaring: false }]) {
      const { ctx, calls } = recordingContext();
      drawBossCreature(ctx, kind, 600, { ...pose, rear: 0, flash: false, bob: 0, time: 1 }, false);
      expect(calls.length).toBeGreaterThan(5);
    }
    const { ctx, calls } = recordingContext();
    drawBossAttacks(ctx, kind, [thing()], [thing()], [thing(), thing(1)], 0, 1);
    expect(calls.length).toBeGreaterThan(3);
  });
});
