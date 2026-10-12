// Pure game simulation: no DOM, audio, or canvas access, so it can be unit tested.
// Numbers and ordering mirror the original root index.html prototype.
import { ERAS, FLOOR, H, HAZARD_XS, LAST_ERA, LEDGES, PICKUP_POINTS, START_LIVES, W, WORLD_END } from './config';

export type Phase = 'start' | 'playing' | 'clear' | 'victory' | 'gameover';
export type GameEvent = 'jump' | 'collect' | 'hit' | 'clear' | 'gameover';

export interface Box { x: number; y: number; w: number; h: number }

export interface Player extends Box {
  vx: number;
  vy: number;
  grounded: boolean;
  invulnerable: number;
  facing: 1 | -1;
  coyote: number;
  jumpBuffer: number;
}

export interface Platform extends Box { kind: 'ground' | 'ledge' }

interface HazardBase extends Box { active: boolean }
export type Hazard =
  | (HazardBase & { type: 'boulder'; baseX: number; phase: number; range: number })
  | (HazardBase & { type: 'bat' | 'drone'; baseY: number; phase: number })
  | (HazardBase & { type: 'spikes' })
  | (HazardBase & { type: 'laser'; phase: number });

export interface Pickup { x: number; y: number; r: number; taken: boolean; phase: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }

export interface GameState {
  phase: Phase;
  eraIndex: number;
  score: number;
  lives: number;
  cameraX: number;
  elapsed: number;
  player: Player;
  platforms: Platform[];
  hazards: Hazard[];
  pickups: Pickup[];
  particles: Particle[];
}

export interface MoveInput { left: boolean; right: boolean }

export const PARTICLE_LIFE = 0.4;
const INVULNERABLE_TIME = 1.25;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.14;
const FINISH_MARGIN = 28;

export function createPlayer(): Player {
  return { x: 75, y: FLOOR - 48, w: 32, h: 44, vx: 0, vy: 0, grounded: true, invulnerable: 0, facing: 1, coyote: 0, jumpBuffer: 0 };
}

function buildHazard(eraIndex: number, x: number, i: number): Hazard {
  if (eraIndex === 0) return { type: 'boulder', x, y: FLOOR - 37, w: 38, h: 37, baseX: x, phase: i * 1.7, range: 55 + (i % 3) * 15, active: false };
  if (eraIndex === 1) {
    const y = FLOOR - 132 - (i % 3) * 23;
    return i % 2
      ? { type: 'bat', x, y, w: 42, h: 28, baseY: y, phase: i * 1.2, active: false }
      : { type: 'spikes', x, y: FLOOR - 24, w: 48, h: 24, active: false };
  }
  const y = FLOOR - 126 - (i % 3) * 24;
  return i % 2
    ? { type: 'drone', x, y, w: 38, h: 30, baseY: y, phase: i * 1.4, active: false }
    : { type: 'laser', x, y: FLOOR - 84, w: 16, h: 84, phase: i * 1.1, active: false };
}

/** Resets the level for an era, keeping score, lives, and elapsed time. */
export function buildLevel(state: GameState, eraIndex: number): void {
  state.eraIndex = eraIndex;
  state.platforms = [{ x: 0, y: FLOOR, w: WORLD_END, h: 90, kind: 'ground' }];
  for (const [x, y, w] of LEDGES) state.platforms.push({ x, y, w, h: 18, kind: 'ledge' });
  state.hazards = HAZARD_XS.map((x, i) => buildHazard(eraIndex, x, i));
  state.pickups = [];
  for (let i = 0; i < 25; i++) {
    const x = 235 + i * 132;
    const ledge = LEDGES.find(([ledgeX]) => Math.abs(ledgeX + 55 - x) < 75);
    state.pickups.push({ x, y: ledge ? ledge[1] - 35 : FLOOR - 66 - (i % 3) * 18, r: 12, taken: false, phase: i * 0.6 });
  }
  state.particles = [];
  state.player = createPlayer();
  state.cameraX = 0;
}

export function createGame(): GameState {
  const state = { phase: 'start', eraIndex: 0, score: 0, lives: START_LIVES, cameraX: 0, elapsed: 0 } as GameState;
  buildLevel(state, 0);
  return state;
}

export function beginGame(state: GameState): void {
  state.score = 0;
  state.lives = START_LIVES;
  state.elapsed = 0;
  buildLevel(state, 0);
  state.phase = 'playing';
}

/** Leaves the era-clear screen: next era, or victory after the last era. */
export function advanceEra(state: GameState): void {
  if (state.eraIndex === LAST_ERA) {
    state.phase = 'victory';
    return;
  }
  buildLevel(state, state.eraIndex + 1);
  state.phase = 'playing';
}

export function requestJump(state: GameState): void {
  state.player.jumpBuffer = JUMP_BUFFER_TIME;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function hurt(state: GameState, events: GameEvent[]): void {
  const { player } = state;
  if (player.invulnerable > 0) return;
  state.lives--;
  events.push('hit');
  player.invulnerable = INVULNERABLE_TIME;
  player.vy = -360;
  player.vx = -player.facing * 210;
  if (state.lives <= 0) {
    state.lives = 0;
    state.phase = 'gameover';
    events.push('gameover');
  }
}

/** Advances one frame. Returns events for sound and UI, in the order they happened. */
export function step(state: GameState, input: MoveInput, dt: number, random: () => number = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.phase !== 'playing') return events;
  state.elapsed += dt;
  const era = ERAS[state.eraIndex];
  const { player } = state;
  const previousBottom = player.y + player.h;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  if (input.left !== input.right) {
    player.vx = input.left ? -era.speed : era.speed;
    player.facing = input.left ? -1 : 1;
  } else player.vx *= Math.pow(0.0008, dt);
  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(WORLD_END - player.w, player.x));
  player.vy += era.gravity * dt;
  player.y += player.vy * dt;

  player.grounded = false;
  for (const platform of state.platforms) {
    if (player.vy >= 0 && previousBottom <= platform.y + 5 && player.y + player.h >= platform.y && player.x + player.w > platform.x && player.x < platform.x + platform.w) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.coyote = COYOTE_TIME;
    }
  }
  if (!player.grounded) player.coyote = Math.max(0, player.coyote - dt);
  if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = -era.jump;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    events.push('jump');
  }

  if (player.y > H + 130) {
    hurt(state, events);
    player.x = Math.max(40, player.x - 90);
    player.y = FLOOR - player.h;
    player.vy = 0;
  }

  for (const hazard of state.hazards) {
    if (hazard.type === 'boulder') {
      hazard.x = hazard.baseX + Math.sin(state.elapsed * 1.7 + hazard.phase) * hazard.range;
    } else if (hazard.type === 'bat' || hazard.type === 'drone') {
      hazard.y = hazard.baseY + Math.sin(state.elapsed * 2.5 + hazard.phase) * 34;
      hazard.x += Math.sin(state.elapsed * 1.1 + hazard.phase) * 12 * dt;
    }
    hazard.active = hazard.type !== 'laser' || Math.sin(state.elapsed * 2.4 + hazard.phase) > -0.24;
    if (hazard.active && overlaps(player, { x: hazard.x + 4, y: hazard.y + 3, w: hazard.w - 8, h: hazard.h - 5 })) hurt(state, events);
  }

  for (const pickup of state.pickups) {
    if (!pickup.taken && overlaps(player, { x: pickup.x - pickup.r, y: pickup.y - pickup.r, w: pickup.r * 2, h: pickup.r * 2 })) {
      pickup.taken = true;
      state.score += PICKUP_POINTS;
      events.push('collect');
      for (let i = 0; i < 5; i++) {
        state.particles.push({ x: pickup.x, y: pickup.y, vx: (random() - 0.5) * 150, vy: -random() * 180, life: PARTICLE_LIFE, color: era.accent });
      }
    }
  }

  for (const p of state.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 430 * dt;
    p.life -= dt;
  }
  state.particles = state.particles.filter(p => p.life > 0);
  state.cameraX = Math.max(0, Math.min(WORLD_END - W, player.x - W * 0.32));

  // The prototype could overwrite a same-frame game over with an era clear; losing the last life wins.
  if (state.phase === 'playing' && player.x + player.w >= WORLD_END - FINISH_MARGIN) {
    state.phase = 'clear';
    events.push('clear');
  }
  return events;
}

/** Clamps a requestAnimationFrame delta exactly as the prototype did. */
export function frameDelta(timestamp: number, lastTime: number): number {
  return Math.min(0.033, Math.max(0, (timestamp - lastTime) / 1000 || 0));
}
