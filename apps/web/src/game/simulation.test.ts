import { describe, expect, it } from 'vitest';
import { CHECKPOINT_X, ERAS, FLOOR, H, HAZARD_XS, SKINS, START_X, WORLD_END, type EraId } from './config';
import { CHECKPOINT_SAFE, FINISH_SAFE, START_SAFE, levelLayout } from './level';
import {
  CRUMBLE_TIME, SCARE_TIME, advanceEra, beginGame, buildLevel, createGame, frameDelta, groundAt, requestJump, retryEra, step,
  type GameEvent, type GameState
} from './simulation';

const DT = 1 / 60;
const idle = { left: false, right: false };
const right = { left: false, right: true };
const fixedRandom = () => 0.5;
const eraIndex = (id: EraId) => ERAS.findIndex(e => e.id === id);

function run(state: GameState, input: typeof idle, frames: number): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < frames; i++) events.push(...step(state, input, DT));
  return events;
}

/** A game in progress in the given era with the player standing on the floor. Scares are off unless a test turns them on. */
function playing(id: EraId = 'stone'): GameState {
  const state = createGame();
  state.scaresEnabled = false;
  beginGame(state);
  if (id !== 'stone') buildLevel(state, eraIndex(id));
  // The player spawns slightly above the floor, as in the prototype; let them land.
  let frames = 0;
  do step(state, idle, DT); while (!state.player.grounded && ++frames < 30);
  if (!state.player.grounded) throw new Error('player never landed');
  return state;
}

/** Removes hazards and pickups so a test controls exactly what the player meets. */
function clearArea(state: GameState): GameState {
  state.hazards = [];
  state.pickups = [];
  return state;
}

describe('eras', () => {
  it('has ten eras that get faster and more dangerous', () => {
    expect(ERAS).toHaveLength(10);
    expect(new Set(ERAS.map(e => e.id)).size).toBe(10);
    for (let i = 1; i < ERAS.length; i++) {
      expect(ERAS[i].tempo).toBeGreaterThan(ERAS[i - 1].tempo);
      expect(ERAS[i].pits).toBeGreaterThanOrEqual(ERAS[i - 1].pits);
    }
    expect(ERAS.at(-1)?.pits).toBeGreaterThanOrEqual(5);
  });

  it('keeps the first era identical to the original prototype', () => {
    const stone = ERAS[0];
    expect(stone).toMatchObject({ name: 'STONE AGE', gravity: 1900, speed: 245, jump: 650, tempo: 1, pits: 0 });
    const state = createGame();
    expect(state.platforms.filter(p => p.kind === 'ground')).toEqual([expect.objectContaining({ x: 0, w: WORLD_END })]);
    expect(state.hazards.map(h => [h.skin, h.x])).toEqual(HAZARD_XS.map(x => ['boulder', x]));
    expect(state.pickups).toHaveLength(25);
  });
});

describe.each(ERAS.map((era, i) => [era.id, era, i] as const))('%s layout', (_id, era) => {
  const layout = levelLayout(era);
  const pitHits = (x0: number, x1: number) => layout.pits.some(p => x1 > p.x && x0 < p.x + p.w);

  it('has the configured number of pits, each comfortably jumpable', () => {
    expect(layout.pits).toHaveLength(era.pits);
    const jumpDistance = ((2 * era.jump) / era.gravity) * era.speed;
    for (const pit of layout.pits) expect(pit.w).toBeLessThan(jumpDistance * 0.7);
  });

  it('keeps the start, checkpoint, and finish clear', () => {
    for (const pit of layout.pits) {
      expect(pit.x).toBeGreaterThan(START_SAFE);
      expect(pit.x + pit.w).toBeLessThan(FINISH_SAFE);
      expect(pit.x + pit.w < CHECKPOINT_X - CHECKPOINT_SAFE / 2 || pit.x > CHECKPOINT_X + CHECKPOINT_SAFE / 2).toBe(true);
    }
    for (const hazard of layout.hazards) {
      expect(hazard.x).toBeGreaterThan(START_SAFE);
      expect(hazard.x).toBeLessThan(WORLD_END - 150);
    }
  });

  it('never puts ground hazards in or swaying into pits', () => {
    const state = createGame();
    buildLevel(state, ERAS.indexOf(era));
    const onGround = state.hazards.filter(h => h.kind === 'roller' || h.kind === 'spikes' || h.kind === 'beam');
    for (const hazard of onGround) {
      const reach = hazard.kind === 'roller' ? hazard.range : 0;
      expect(pitHits(hazard.baseX - reach, hazard.baseX + hazard.w + reach)).toBe(false);
    }
  });

  it('has ground under the start and checkpoint', () => {
    const state = createGame();
    buildLevel(state, ERAS.indexOf(era));
    expect(groundAt(state, START_X)).toBeDefined();
    expect(groundAt(state, CHECKPOINT_X)).toBeDefined();
    expect(groundAt(state, WORLD_END - 40)).toBeDefined();
  });
});

describe('movement', () => {
  it.each(ERAS.filter(e => !e.ice).map(e => e.id))('moves at %s speed and stays grounded', id => {
    const state = clearArea(playing(id));
    const x = state.player.x;
    step(state, right, DT);
    expect(state.player.x).toBeCloseTo(x + ERAS[eraIndex(id)].speed * DT);
    expect(state.player).toMatchObject({ grounded: true, vy: 0, facing: 1, y: FLOOR - state.player.h });
  });

  it('slows to a stop without input', () => {
    const state = clearArea(playing());
    step(state, right, DT);
    run(state, idle, 60);
    expect(Math.abs(state.player.vx)).toBeLessThan(1);
  });

  it('speeds up and slides gradually on ice', () => {
    const state = clearArea(playing('viking'));
    const { speed } = ERAS[eraIndex('viking')];
    step(state, right, DT);
    expect(state.player.vx).toBeGreaterThan(0);
    expect(state.player.vx).toBeLessThan(speed * 0.2);
    run(state, right, 90);
    expect(state.player.vx).toBeGreaterThan(speed * 0.9);
    run(state, idle, 12);
    expect(state.player.vx).toBeGreaterThan(speed * 0.6);
  });

  it('jumps with the era jump velocity', () => {
    const state = clearArea(playing('medieval'));
    requestJump(state);
    expect(step(state, idle, DT)).toContain('jump');
    expect(state.player.vy).toBe(-ERAS[eraIndex('medieval')].jump);
    expect(state.player.grounded).toBe(false);
  });

  it('allows a jump shortly after leaving the ground (coyote time)', () => {
    const state = clearArea(playing());
    step(state, idle, DT);
    state.player.y -= 50; // walked off a ledge
    step(state, idle, DT);
    requestJump(state);
    expect(step(state, idle, DT)).toContain('jump');
  });

  it('buffers a jump pressed just before landing, but not forever', () => {
    const state = clearArea(playing());
    state.player.y = FLOOR - state.player.h - 0.3; // lands this frame
    state.player.grounded = false;
    requestJump(state);
    expect(step(state, idle, DT)).toContain('jump');

    const late = clearArea(playing());
    late.player.y -= 200;
    late.player.coyote = 0;
    requestJump(late);
    const events = run(late, idle, 12);
    expect(late.player.grounded).toBe(false);
    expect(late.player.jumpBuffer).toBe(0);
    expect(events).not.toContain('jump');
  });

  it('follows the player with the camera, clamped to the world', () => {
    const state = clearArea(playing());
    state.player.x = 1000;
    step(state, idle, DT);
    expect(state.cameraX).toBeCloseTo(state.player.x - 960 * 0.32);
    state.player.x = WORLD_END - 100;
    step(state, idle, DT);
    expect(state.cameraX).toBe(WORLD_END - 960);
  });
});

describe('pickups and damage', () => {
  it('collects a pickup for 100 points with particles', () => {
    const state = playing();
    state.hazards = [];
    const pickup = state.pickups[0];
    state.player.x = pickup.x - 10;
    state.player.y = pickup.y - 10;
    expect(step(state, idle, DT, fixedRandom)).toContain('collect');
    expect(pickup.taken).toBe(true);
    expect(state.score).toBe(100);
    expect(state.particles).toHaveLength(5);
  });

  it('awards an extra life each time the score passes 2,000, up to five lives', () => {
    const state = playing();
    state.hazards = [];
    const collectNext = () => {
      const pickup = state.pickups.find(p => !p.taken);
      if (!pickup) throw new Error('no pickups left');
      state.player.x = pickup.x - 10;
      state.player.y = pickup.y - 10;
      return step(state, idle, DT, fixedRandom);
    };
    state.score = 1800;
    expect(collectNext()).not.toContain('extraLife');
    expect(collectNext()).toContain('extraLife');
    expect(state).toMatchObject({ score: 2000, lives: 4 });
    expect(state.popups).toEqual([expect.objectContaining({ text: '+1 ♥' })]);
    run(state, idle, 90);
    expect(state.popups).toEqual([]);

    state.score = 3900;
    expect(collectNext()).toContain('extraLife');
    expect(state.lives).toBe(5);
    state.score = 5900;
    expect(collectNext()).not.toContain('extraLife');
    expect(state).toMatchObject({ score: 6000, lives: 5 });
  });

  it('loses a life on a hazard, then is briefly invulnerable', () => {
    const state = playing('medieval');
    state.pickups = [];
    const spikes = state.hazards[0];
    expect(spikes.skin).toBe('spikes');
    state.hazards = [spikes];
    state.player.x = spikes.x;
    expect(step(state, idle, DT)).toEqual(['hit']);
    expect(state.lives).toBe(2);
    expect(state.player.invulnerable).toBeGreaterThan(1);
    expect(state.player.vx).toBe(-210);
    state.player.x = spikes.x;
    state.player.y = FLOOR - state.player.h;
    expect(step(state, idle, DT)).not.toContain('hit');
    expect(state.lives).toBe(2);
  });

  it('ends the game when the last life is lost', () => {
    const state = playing('medieval');
    state.hazards = [state.hazards[0]];
    state.lives = 1;
    state.player.x = state.hazards[0].x;
    expect(step(state, idle, DT)).toContain('gameover');
    expect(state).toMatchObject({ phase: 'gameover', lives: 0 });
  });

  it('drops a dropper when the player approaches, and it hurts', () => {
    const state = clearArea(playing('viking'));
    buildLevel(state, eraIndex('viking'));
    state.pickups = [];
    const icicle = state.hazards.find(h => h.kind === 'dropper');
    if (!icicle) throw new Error('no icicle');
    state.hazards = [icicle];
    state.player.x = icicle.x - 400;
    run(state, idle, 30);
    expect(icicle.mode).toBe('wait');
    state.player.x = icicle.x - 20;
    state.player.vx = 0;
    const events = run(state, idle, 60);
    expect(events).toContain('hit');
    expect(icicle.mode).not.toBe('wait');
    state.player.x = icicle.x - 600; // walk away so it does not drop again
    run(state, idle, 120);
    expect(icicle).toMatchObject({ mode: 'wait', y: icicle.baseY });
  });

  it('flies projectiles toward the player and restarts them', () => {
    const state = clearArea(playing('pirate'));
    buildLevel(state, eraIndex('pirate'));
    const ball = state.hazards.find(h => h.kind === 'projectile');
    if (!ball) throw new Error('no cannonball');
    state.hazards = [ball];
    state.pickups = [];
    state.player.x = START_X;
    ball.x = ball.baseX;
    step(state, idle, DT);
    expect(ball.x).toBeLessThan(ball.baseX);
    ball.x = ball.baseX - ball.range - 1;
    step(state, idle, DT);
    expect(ball.x).toBe(ball.baseX);
  });

  it('crumbles a cracked ledge shortly after it is stepped on', () => {
    const state = clearArea(playing('egypt'));
    const ledge = state.platforms.find(p => p.crumble);
    if (!ledge) throw new Error('no crumbling ledge');
    state.player.x = ledge.x + 20;
    state.player.y = ledge.y - state.player.h - 0.3;
    state.player.vy = 0;
    run(state, idle, 2);
    expect(ledge.crumbleTime).toBeGreaterThan(0);
    run(state, idle, Math.ceil(CRUMBLE_TIME / DT) + 1);
    expect(ledge.fallen).toBe(true);
    expect(state.player.y).toBeGreaterThan(ledge.homeY - state.player.h);
  });
});

/** Drops the player into the era's first pit and lets them fall. */
function fallIntoPit(state: GameState): GameEvent[] {
  const pit = levelLayout(ERAS[state.eraIndex]).pits[0];
  state.player.x = pit.x + pit.w / 2 - state.player.w / 2;
  state.player.vx = 0;
  return run(state, idle, 60);
}

describe('pits and checkpoints', () => {
  it('costs a life and respawns at the era start before the checkpoint', () => {
    const state = clearArea(playing('viking'));
    expect(levelLayout(ERAS[state.eraIndex]).pits[0].x).toBeLessThan(CHECKPOINT_X);
    expect(fallIntoPit(state)).toContain('hit');
    expect(state.lives).toBe(2);
    expect(state.player.x).toBe(START_X);
    expect(state.player.y).toBeLessThanOrEqual(FLOOR);
  });

  it('respawns at the checkpoint once it is reached, and restores crumbled ledges', () => {
    const state = clearArea(playing('haunted'));
    state.player.x = CHECKPOINT_X + 5;
    expect(step(state, idle, DT)).toContain('checkpoint');
    expect(run(state, idle, 5)).not.toContain('checkpoint');
    const ledge = state.platforms.find(p => p.crumble);
    if (!ledge) throw new Error('no crumbling ledge');
    ledge.fallen = true;
    ledge.y = H + 60;
    const pit = levelLayout(ERAS[state.eraIndex]).pits.find(p => p.x > CHECKPOINT_X);
    if (!pit) throw new Error('no pit after the checkpoint');
    state.player.x = pit.x + pit.w / 2 - state.player.w / 2;
    run(state, idle, 60);
    expect(state.player.x).toBe(CHECKPOINT_X);
    expect(ledge).toMatchObject({ fallen: false, y: ledge.homeY });
  });

  it('retries a lost era from the checkpoint with full lives and the era starting score', () => {
    const state = clearArea(playing('pirate'));
    state.levelStartScore = 800;
    state.score = 1500;
    state.player.x = CHECKPOINT_X + 5;
    step(state, idle, DT);
    state.lives = 0;
    state.phase = 'gameover';
    retryEra(state);
    expect(state).toMatchObject({ phase: 'playing', eraIndex: eraIndex('pirate'), lives: 3, score: 800, checkpointX: CHECKPOINT_X });
    expect(state.player.x).toBe(CHECKPOINT_X);
    expect(state.scareTriggers.every(x => x > CHECKPOINT_X)).toBe(true);
  });
});

describe('jump scares', () => {
  it('freezes the world while a scare plays, then carries on', () => {
    const state = clearArea(playing('egypt'));
    state.scaresEnabled = true;
    const trigger = ERAS[eraIndex('egypt')].scareXs[0];
    state.player.x = trigger - 2;
    expect(run(state, right, 2)).toContain('scare');
    expect(state.scare?.kind).toBe('mummy');
    const frozenX = state.player.x;
    run(state, right, Math.floor(SCARE_TIME / DT) - 2);
    expect(state.player.x).toBe(frozenX);
    run(state, right, 5);
    expect(state.scare).toBeNull();
    expect(state.player.x).toBeGreaterThan(frozenX);
  });

  it('skips scares when they are turned off, without replaying them later', () => {
    const state = clearArea(playing('egypt'));
    const trigger = ERAS[eraIndex('egypt')].scareXs[0];
    state.player.x = trigger + 1;
    expect(step(state, idle, DT)).not.toContain('scare');
    state.scaresEnabled = true;
    expect(run(state, idle, 5)).not.toContain('scare');
    expect(state.scare).toBeNull();
  });

  it('gives every era its own creature', () => {
    expect(new Set(ERAS.map(e => e.scare)).size).toBe(ERAS.length);
    for (const era of ERAS) expect(era.scareXs.length).toBeGreaterThan(0);
  });
});

describe('progression', () => {
  it('clears the era at the finish line', () => {
    const state = clearArea(playing());
    state.player.x = WORLD_END - 62;
    expect(step(state, right, DT)).toContain('clear');
    expect(state.phase).toBe('clear');
  });

  it('keeps a game over when the finish is reached in the same frame', () => {
    const state = clearArea(playing());
    state.lives = 1;
    const spikes = { ...playing('medieval').hazards[0], x: WORLD_END - 60, baseX: WORLD_END - 60 };
    state.hazards = [spikes];
    state.player.x = WORLD_END - 60;
    expect(step(state, right, DT)).not.toContain('clear');
    expect(state.phase).toBe('gameover');
  });

  it('advances through all ten eras keeping score and lives, then wins', () => {
    const state = playing();
    state.score = 1200;
    state.lives = 2;
    for (let i = 1; i < ERAS.length; i++) {
      state.phase = 'clear';
      advanceEra(state);
      expect(state).toMatchObject({ phase: 'playing', eraIndex: i, score: 1200, lives: 2, levelStartScore: 1200, checkpointX: START_X });
      expect(state.player.x).toBe(START_X);
    }
    state.phase = 'clear';
    advanceEra(state);
    expect(state).toMatchObject({ phase: 'victory', eraIndex: ERAS.length - 1, score: 1200 });
  });

  it('restarts from the Stone Age with a fresh run', () => {
    const state = playing('future');
    state.score = 900;
    state.lives = 0;
    state.elapsed = 40;
    state.phase = 'gameover';
    beginGame(state);
    expect(state).toMatchObject({ phase: 'playing', eraIndex: 0, score: 0, levelStartScore: 0, lives: 3, elapsed: 0 });
    expect(state.pickups.every(p => !p.taken)).toBe(true);
  });
});

describe('frameDelta', () => {
  it('clamps long frames and handles the first frame', () => {
    expect(frameDelta(1000, 0)).toBe(0.033);
    expect(frameDelta(1016, 1000)).toBeCloseTo(0.016);
    expect(frameDelta(500, 1000)).toBe(0);
    expect(frameDelta(Number.NaN, 0)).toBe(0);
  });
});

it('defines every skin used by an era', () => {
  for (const era of ERAS) for (const skin of [...era.groundHazards, ...era.airHazards]) expect(SKINS[skin]).toBeDefined();
});
