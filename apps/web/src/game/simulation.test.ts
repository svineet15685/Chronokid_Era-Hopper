import { describe, expect, it } from 'vitest';
import { ERAS, FLOOR, WORLD_END } from './config';
import { advanceEra, beginGame, buildLevel, createGame, frameDelta, requestJump, step, type GameState } from './simulation';

const DT = 1 / 60;
const idle = { left: false, right: false };
const right = { left: false, right: true };
const fixedRandom = () => 0.5;

function playing(eraIndex = 0): GameState {
  const state = createGame();
  beginGame(state);
  if (eraIndex) buildLevel(state, eraIndex);
  // The player spawns slightly above the floor, as in the prototype; let them land.
  let frames = 0;
  do step(state, idle, DT); while (!state.player.grounded && ++frames < 30);
  if (!state.player.grounded) throw new Error('player never landed');
  return state;
}

/** Moves the player somewhere with no hazards or pickups nearby. */
function clearArea(state: GameState): GameState {
  state.hazards = [];
  state.pickups = [];
  return state;
}

describe('level layout', () => {
  it('starts on the start screen in the Stone Age with full lives', () => {
    const state = createGame();
    expect(state).toMatchObject({ phase: 'start', eraIndex: 0, score: 0, lives: 3 });
    expect(state.platforms).toHaveLength(10);
    expect(state.pickups).toHaveLength(25);
    expect(state.hazards.map(h => h.type)).toEqual(Array(9).fill('boulder'));
  });

  it('uses each era\'s hazards', () => {
    const state = createGame();
    buildLevel(state, 1);
    expect(new Set(state.hazards.map(h => h.type))).toEqual(new Set(['spikes', 'bat']));
    buildLevel(state, 2);
    expect(new Set(state.hazards.map(h => h.type))).toEqual(new Set(['laser', 'drone']));
  });

  it('floats pickups above nearby ledges', () => {
    const state = createGame();
    const pickup = state.pickups.find(p => p.x === 367);
    expect(pickup?.y).toBe(385 - 35);
  });
});

describe('step', () => {
  it('does nothing outside of play', () => {
    const state = createGame();
    const before = structuredClone(state);
    expect(step(state, right, DT)).toEqual([]);
    expect(state).toEqual(before);
  });

  it.each([0, 1, 2])('moves at era %i speed and stays grounded', eraIndex => {
    const state = clearArea(playing(eraIndex));
    const x = state.player.x;
    step(state, right, DT);
    expect(state.player.x).toBeCloseTo(x + ERAS[eraIndex].speed * DT);
    expect(state.player).toMatchObject({ grounded: true, vy: 0, facing: 1, y: FLOOR - state.player.h });
  });

  it('slows to a stop without input', () => {
    const state = clearArea(playing());
    step(state, right, DT);
    for (let i = 0; i < 60; i++) step(state, idle, DT);
    expect(Math.abs(state.player.vx)).toBeLessThan(1);
  });

  it('jumps with the era jump velocity', () => {
    const state = clearArea(playing(1));
    requestJump(state);
    expect(step(state, idle, DT)).toContain('jump');
    expect(state.player.vy).toBe(-ERAS[1].jump);
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
    const events = [];
    for (let i = 0; i < 12; i++) events.push(...step(late, idle, DT));
    expect(late.player.grounded).toBe(false);
    expect(late.player.jumpBuffer).toBe(0);
    expect(events).not.toContain('jump');
  });

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

  it('loses a life on a hazard, then is briefly invulnerable', () => {
    const state = playing(1);
    state.pickups = [];
    state.player.x = state.hazards[0].x; // spikes at ground level
    expect(step(state, idle, DT)).toEqual(['hit']);
    expect(state.lives).toBe(2);
    expect(state.player.invulnerable).toBeGreaterThan(1);
    expect(state.player.vx).toBe(-210);
    state.player.x = state.hazards[0].x;
    state.player.y = FLOOR - state.player.h;
    expect(step(state, idle, DT)).not.toContain('hit');
    expect(state.lives).toBe(2);
  });

  it('ends the game when the last life is lost', () => {
    const state = playing(1);
    state.lives = 1;
    state.player.x = state.hazards[0].x;
    expect(step(state, idle, DT)).toContain('gameover');
    expect(state).toMatchObject({ phase: 'gameover', lives: 0 });
  });

  it('clears the era at the finish line', () => {
    const state = clearArea(playing());
    state.player.x = WORLD_END - 62;
    expect(step(state, right, DT)).toContain('clear');
    expect(state.phase).toBe('clear');
  });

  it('keeps a game over when the finish is reached in the same frame', () => {
    const state = clearArea(playing());
    state.lives = 1;
    state.hazards = [{ type: 'spikes', x: WORLD_END - 60, y: FLOOR - 24, w: 48, h: 24, active: true }];
    state.player.x = WORLD_END - 60;
    expect(step(state, right, DT)).not.toContain('clear');
    expect(state.phase).toBe('gameover');
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

describe('progression', () => {
  it('advances through the eras keeping score and lives, then wins', () => {
    const state = playing();
    state.score = 1200;
    state.lives = 2;
    state.phase = 'clear';
    advanceEra(state);
    expect(state).toMatchObject({ phase: 'playing', eraIndex: 1, score: 1200, lives: 2 });
    expect(state.player.x).toBe(75);
    state.phase = 'clear';
    advanceEra(state);
    expect(state.eraIndex).toBe(2);
    state.phase = 'clear';
    advanceEra(state);
    expect(state).toMatchObject({ phase: 'victory', eraIndex: 2, score: 1200 });
  });

  it('restarts from the Stone Age with a fresh run', () => {
    const state = playing(2);
    state.score = 900;
    state.lives = 0;
    state.elapsed = 40;
    state.phase = 'gameover';
    beginGame(state);
    expect(state).toMatchObject({ phase: 'playing', eraIndex: 0, score: 0, lives: 3, elapsed: 0 });
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
