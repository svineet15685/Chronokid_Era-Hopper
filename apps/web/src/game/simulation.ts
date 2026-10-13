// Pure game simulation: no DOM, audio, or canvas access, so it can be unit tested.
// The first era keeps the original prototype's numbers and ordering.
import { CHECKPOINT_X, ERAS, EXTRA_LIFE_POINTS, FLOOR, H, LAST_ERA, LEDGES, MAX_LIVES, PICKUP_POINTS, SKINS, START_LIVES, START_X, W, WORLD_END, type HazardKind, type ScareKind, type SkinName } from './config';
import { GAME_RULES } from '@chronokid/shared';
import { levelLayout, type HazardSlot } from './level';

export type Phase = 'start' | 'playing' | 'clear' | 'victory' | 'gameover';
export type GameEvent = 'jump' | 'collect' | 'extraLife' | 'hit' | 'clear' | 'gameover' | 'checkpoint' | 'scare' | 'powerup' | 'shieldBreak';

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

export interface Platform extends Box {
  kind: 'ground' | 'ledge';
  crumble: boolean;
  /** Seconds since a crumbling ledge was first stepped on; 0 means untouched. */
  crumbleTime: number;
  fallen: boolean;
  homeY: number;
}

export interface Hazard extends Box {
  kind: HazardKind;
  skin: SkinName;
  active: boolean;
  phase: number;
  baseX: number;
  baseY: number;
  /** Rollers: sway distance. Projectiles: distance flown before restarting. */
  range: number;
  /** Droppers only. */
  mode: 'wait' | 'fall' | 'rest';
  vy: number;
  timer: number;
}

export interface Pickup { x: number; y: number; r: number; taken: boolean; phase: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string }
/** Floating text such as "+1 ♥" that drifts up and fades. */
export interface Popup { x: number; y: number; text: string; life: number }
export interface Scare { kind: ScareKind; t: number }

export type PowerKind = 'shield' | 'freeze' | 'magnet' | 'doubleJump';
export interface PowerUp { x: number; y: number; kind: PowerKind; taken: boolean }

/** Active power-up effects. Timers are seconds left; the shield lasts until it absorbs a hit. */
export interface Effects {
  shield: boolean;
  freeze: number;
  magnet: number;
  doubleJump: number;
  /** Whether the double jump's extra air jump has been used since last touching the ground. */
  airJumpUsed: boolean;
}

/** Normal play counts for the leaderboard; practice (started from the era map) does not. */
export type GameMode = 'campaign' | 'practice';

export interface GameState {
  phase: Phase;
  eraIndex: number;
  score: number;
  /** Score when the current era began, restored when retrying it. */
  levelStartScore: number;
  lives: number;
  cameraX: number;
  elapsed: number;
  checkpointX: number;
  scaresEnabled: boolean;
  /** Active jump scare; the world is frozen while it plays. */
  scare: Scare | null;
  /** Upcoming scare positions in this era, ascending. */
  scareTriggers: number[];
  player: Player;
  platforms: Platform[];
  hazards: Hazard[];
  pickups: Pickup[];
  particles: Particle[];
  popups: Popup[];
  mode: GameMode;
  powerups: PowerUp[];
  effects: Effects;
  /** Drives hazard motion; it stops while a time freeze is active. */
  hazardClock: number;
  /** Pickups collected and hits taken in the current era, for its star rating. */
  eraPickups: number;
  eraHits: number;
  /** Stars earned for the era just cleared (1 to 3), shown on the era-clear screen. */
  lastStars: number;
}

export interface MoveInput { left: boolean; right: boolean }

export const PARTICLE_LIFE = 0.4;
export const POPUP_LIFE = 1.2;
export const SCARE_TIME = 1.1;
export const CRUMBLE_TIME = 0.5;
export const DROPPER_TOP = 60;
/** Droppers let go when the player gets this close. */
export const DROPPER_REACH = 110;
const DROPPER_GRAVITY = 1500;
const DROPPER_REST = 0.8;
const PROJECTILE_SPEED = 180;
const PROJECTILE_LEAD = 260;
const PROJECTILE_TRAVEL = 520;
const ICE_ACCEL = 3.5;
const ICE_FRICTION = 1.2;
const INVULNERABLE_TIME = 1.25;
const COYOTE_TIME = 0.1;
const JUMP_BUFFER_TIME = 0.14;
const FINISH_MARGIN = 28;
export const POWER_UP_SIZE = 28;
export const FREEZE_TIME = 4;
export const MAGNET_TIME = 8;
export const DOUBLE_JUMP_TIME = 10;
const MAGNET_RANGE = 170;
const MAGNET_SPEED = 420;
const POWER_KINDS: readonly PowerKind[] = ['shield', 'freeze', 'magnet', 'doubleJump'];
export const POWER_LABELS: Record<PowerKind, string> = { shield: 'SHIELD!', freeze: 'TIME FREEZE!', magnet: 'MAGNET!', doubleJump: 'DOUBLE JUMP!' };
/** Pickups needed (out of 25) for the collecting star. */
export const STAR_PICKUPS = 20;
/** Power-up boxes float above these ledges (indexes into LEDGES), clear of the pickups there. */
const POWER_UP_LEDGES: readonly (readonly [ledge: number, offset: number])[] = [[2, 30], [7, 50]];

export function createPlayer(): Player {
  return { x: START_X, y: FLOOR - 48, w: 32, h: 44, vx: 0, vy: 0, grounded: true, invulnerable: 0, facing: 1, coyote: 0, jumpBuffer: 0 };
}

function buildHazard(slot: HazardSlot, i: number): Hazard {
  const skin: { kind: HazardKind; w: number; h: number; phaseStep: number; lift?: number; liftStep?: number } = SKINS[slot.skin];
  const hazard: Hazard = {
    kind: skin.kind, skin: slot.skin, x: slot.x, y: FLOOR - skin.h, w: skin.w, h: skin.h, active: false,
    phase: i * skin.phaseStep, baseX: slot.x, baseY: FLOOR - skin.h, range: 0, mode: 'wait', vy: 0, timer: 0
  };
  if (skin.kind === 'roller') hazard.range = 55 + (i % 3) * 15;
  if (skin.kind === 'flyer') hazard.y = hazard.baseY = FLOOR - (skin.lift ?? 120) - (i % 3) * (skin.liftStep ?? 20);
  if (skin.kind === 'dropper') hazard.y = hazard.baseY = DROPPER_TOP;
  if (skin.kind === 'projectile') {
    hazard.baseX = slot.x + PROJECTILE_LEAD;
    hazard.range = PROJECTILE_TRAVEL;
    hazard.x = hazard.baseX - ((i * 173) % PROJECTILE_TRAVEL);
    hazard.y = hazard.baseY = FLOOR - skin.h - 8;
  }
  return hazard;
}

/** Resets the level for an era, keeping score, lives, and elapsed time. */
export function buildLevel(state: GameState, eraIndex: number): void {
  const era = ERAS[eraIndex];
  const layout = levelLayout(era);
  state.eraIndex = eraIndex;

  const ground: Platform[] = [];
  let groundStart = 0;
  for (const pit of [...layout.pits, { x: WORLD_END, w: 0 }]) {
    ground.push({ x: groundStart, y: FLOOR, w: pit.x - groundStart, h: 90, kind: 'ground', crumble: false, crumbleTime: 0, fallen: false, homeY: FLOOR });
    groundStart = pit.x + pit.w;
  }
  const ledges = LEDGES.map(([x, y, w], i): Platform => ({ x, y, w, h: 18, kind: 'ledge', crumble: !!era.crumble && i % 2 === 1, crumbleTime: 0, fallen: false, homeY: y }));
  state.platforms = [...ground, ...ledges];
  state.hazards = layout.hazards.map(buildHazard);
  state.pickups = [];
  for (let i = 0; i < GAME_RULES.pickupsPerEra; i++) {
    const x = 235 + i * 132;
    const ledge = LEDGES.find(([ledgeX]) => Math.abs(ledgeX + 55 - x) < 75);
    state.pickups.push({ x, y: ledge ? ledge[1] - 35 : FLOOR - 66 - (i % 3) * 18, r: 12, taken: false, phase: i * 0.6 });
  }
  state.particles = [];
  state.popups = [];
  // Two power-ups per era, rotating through the kinds so every era mixes them differently.
  state.powerups = POWER_UP_LEDGES.map(([ledge, offset], i) => {
    const [x, y] = LEDGES[ledge];
    return { x: x + offset, y: y - 34, kind: POWER_KINDS[(eraIndex + i * 2) % POWER_KINDS.length], taken: false };
  });
  state.effects = { shield: false, freeze: 0, magnet: 0, doubleJump: 0, airJumpUsed: false };
  state.eraPickups = 0;
  state.eraHits = 0;
  state.lastStars = 0;
  state.player = createPlayer();
  state.cameraX = 0;
  state.checkpointX = START_X;
  state.scare = null;
  state.scareTriggers = [...era.scareXs];
}

export function createGame(): GameState {
  const state = { phase: 'start', eraIndex: 0, score: 0, levelStartScore: 0, lives: START_LIVES, cameraX: 0, elapsed: 0, hazardClock: 0, scaresEnabled: true, mode: 'campaign' } as GameState;
  buildLevel(state, 0);
  return state;
}

/** Starts a fresh game: normally from the first era, or from any era as practice. */
export function beginGame(state: GameState, eraIndex = 0, mode: GameMode = 'campaign'): void {
  state.mode = mode;
  state.score = 0;
  state.levelStartScore = 0;
  state.lives = START_LIVES;
  state.elapsed = 0;
  state.hazardClock = 0;
  buildLevel(state, eraIndex);
  state.phase = 'playing';
}

/** Leaves the era-clear screen: next era, or victory after the last era. */
export function advanceEra(state: GameState): void {
  if (state.eraIndex === LAST_ERA) {
    state.phase = 'victory';
    return;
  }
  buildLevel(state, state.eraIndex + 1);
  state.levelStartScore = state.score;
  state.phase = 'playing';
}

/** After a game over: replay this era from the last checkpoint with full lives and the era's starting score. */
export function retryEra(state: GameState): void {
  const checkpointX = state.checkpointX;
  buildLevel(state, state.eraIndex);
  state.score = state.levelStartScore;
  state.lives = START_LIVES;
  state.checkpointX = checkpointX;
  state.player.x = checkpointX;
  state.scareTriggers = state.scareTriggers.filter(x => x > checkpointX);
  state.phase = 'playing';
}

export function requestJump(state: GameState): void {
  state.player.jumpBuffer = JUMP_BUFFER_TIME;
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function groundAt(state: GameState, x: number): Platform | undefined {
  return state.platforms.find(p => p.kind === 'ground' && x >= p.x && x < p.x + p.w);
}

function hurt(state: GameState, events: GameEvent[]): void {
  const { player } = state;
  if (player.invulnerable > 0) return;
  if (state.effects.shield) {
    // The shield takes the hit instead of a life, with a short grace period and the usual knockback.
    state.effects.shield = false;
    events.push('shieldBreak');
    player.invulnerable = INVULNERABLE_TIME;
    player.vy = -360;
    player.vx = -player.facing * 210;
    return;
  }
  state.lives--;
  state.eraHits++;
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

/** Puts the player back at the last checkpoint and restores crumbled ledges. */
function respawn(state: GameState): void {
  const { player } = state;
  player.x = state.checkpointX;
  player.y = FLOOR - player.h;
  player.vx = 0;
  player.vy = 0;
  for (const platform of state.platforms) {
    if (!platform.crumble) continue;
    platform.crumbleTime = 0;
    platform.fallen = false;
    platform.y = platform.homeY;
  }
}

function updateHazard(state: GameState, hazard: Hazard, dt: number): void {
  const tempo = ERAS[state.eraIndex].tempo;
  const t = state.hazardClock * tempo;
  const { player } = state;
  switch (hazard.kind) {
    case 'roller':
      hazard.x = hazard.baseX + Math.sin(t * 1.7 + hazard.phase) * hazard.range;
      hazard.active = true;
      break;
    case 'flyer':
      hazard.y = hazard.baseY + Math.sin(t * 2.5 + hazard.phase) * 34;
      hazard.x += Math.sin(t * 1.1 + hazard.phase) * 12 * tempo * dt;
      hazard.active = true;
      break;
    case 'beam':
      hazard.active = Math.sin(t * 2.4 + hazard.phase) > -0.24;
      break;
    case 'spikes':
      hazard.active = true;
      break;
    case 'projectile':
      hazard.x -= PROJECTILE_SPEED * tempo * dt;
      if (hazard.x < hazard.baseX - hazard.range) hazard.x = hazard.baseX;
      hazard.active = true;
      break;
    case 'dropper':
      if (hazard.mode === 'wait') {
        if (player.x + player.w > hazard.x - DROPPER_REACH && player.x < hazard.x + hazard.w) { hazard.mode = 'fall'; hazard.vy = 0; }
      } else if (hazard.mode === 'fall') {
        hazard.vy += DROPPER_GRAVITY * dt;
        hazard.y += hazard.vy * dt;
        if (hazard.y + hazard.h >= FLOOR && groundAt(state, hazard.x + hazard.w / 2)) {
          hazard.y = FLOOR - hazard.h;
          hazard.mode = 'rest';
          hazard.timer = DROPPER_REST;
        } else if (hazard.y > H) {
          hazard.mode = 'rest';
          hazard.timer = DROPPER_REST;
        }
      } else {
        hazard.timer -= dt;
        if (hazard.timer <= 0) { hazard.mode = 'wait'; hazard.y = hazard.baseY; }
      }
      hazard.active = hazard.mode === 'fall';
      break;
  }
}

/** Advances one frame. Returns events for sound and UI, in the order they happened. */
export function step(state: GameState, input: MoveInput, dt: number, random: () => number = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  if (state.phase !== 'playing') return events;
  if (state.scare) {
    state.scare.t += dt;
    if (state.scare.t >= SCARE_TIME) state.scare = null;
    return events;
  }
  state.elapsed += dt;
  const era = ERAS[state.eraIndex];
  const { player, effects } = state;
  const frozen = effects.freeze > 0;
  if (!frozen) state.hazardClock += dt;
  effects.freeze = Math.max(0, effects.freeze - dt);
  effects.magnet = Math.max(0, effects.magnet - dt);
  effects.doubleJump = Math.max(0, effects.doubleJump - dt);
  const previousBottom = player.y + player.h;
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

  const moving = input.left !== input.right;
  if (moving) player.facing = input.left ? -1 : 1;
  if (era.ice) {
    const target = moving ? player.facing * era.speed : 0;
    player.vx += (target - player.vx) * Math.min(1, (moving ? ICE_ACCEL : ICE_FRICTION) * dt);
  } else if (moving) player.vx = input.left ? -era.speed : era.speed;
  else player.vx *= Math.pow(0.0008, dt);
  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(WORLD_END - player.w, player.x));
  player.vy += era.gravity * dt;
  player.y += player.vy * dt;

  player.grounded = false;
  for (const platform of state.platforms) {
    if (platform.fallen) continue;
    if (player.vy >= 0 && previousBottom <= platform.y + 5 && player.y + player.h >= platform.y && player.x + player.w > platform.x && player.x < platform.x + platform.w) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
      player.coyote = COYOTE_TIME;
      if (platform.crumble && platform.crumbleTime === 0) platform.crumbleTime = Number.EPSILON;
    }
  }
  for (const platform of state.platforms) {
    if (!platform.crumble) continue;
    if (platform.fallen) { if (platform.y < H + 60) platform.y += 260 * dt; continue; }
    if (platform.crumbleTime > 0) {
      platform.crumbleTime += dt;
      if (platform.crumbleTime >= CRUMBLE_TIME) platform.fallen = true;
    }
  }
  if (!player.grounded) player.coyote = Math.max(0, player.coyote - dt);
  if (player.grounded) effects.airJumpUsed = false;
  if (player.jumpBuffer > 0 && !player.grounded && player.coyote <= 0 && effects.doubleJump > 0 && !effects.airJumpUsed) {
    // Double jump: one extra, slightly weaker jump in mid-air.
    player.vy = -era.jump * 0.92;
    player.jumpBuffer = 0;
    effects.airJumpUsed = true;
    events.push('jump');
  } else if (player.jumpBuffer > 0 && (player.grounded || player.coyote > 0)) {
    player.vy = -era.jump;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    events.push('jump');
  }

  if (player.y > H + 130) {
    hurt(state, events);
    respawn(state);
  }

  for (const hazard of state.hazards) {
    if (!frozen) updateHazard(state, hazard, dt);
    if (hazard.active && overlaps(player, { x: hazard.x + 4, y: hazard.y + 3, w: hazard.w - 8, h: hazard.h - 5 })) hurt(state, events);
  }

  for (const powerup of state.powerups) {
    const half = POWER_UP_SIZE / 2;
    if (powerup.taken || !overlaps(player, { x: powerup.x - half, y: powerup.y - half, w: POWER_UP_SIZE, h: POWER_UP_SIZE })) continue;
    powerup.taken = true;
    if (powerup.kind === 'shield') effects.shield = true;
    if (powerup.kind === 'freeze') effects.freeze = FREEZE_TIME;
    if (powerup.kind === 'magnet') effects.magnet = MAGNET_TIME;
    if (powerup.kind === 'doubleJump') effects.doubleJump = DOUBLE_JUMP_TIME;
    events.push('powerup');
    state.popups.push({ x: player.x + player.w / 2, y: player.y - 12, text: POWER_LABELS[powerup.kind], life: POPUP_LIFE });
  }

  if (effects.magnet > 0) {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    for (const pickup of state.pickups) {
      const dx = cx - pickup.x;
      const dy = cy - pickup.y;
      const distance = Math.hypot(dx, dy);
      if (pickup.taken || distance > MAGNET_RANGE || distance < 1) continue;
      const pull = Math.min(distance, MAGNET_SPEED * dt);
      pickup.x += (dx / distance) * pull;
      pickup.y += (dy / distance) * pull;
    }
  }

  for (const pickup of state.pickups) {
    if (!pickup.taken && overlaps(player, { x: pickup.x - pickup.r, y: pickup.y - pickup.r, w: pickup.r * 2, h: pickup.r * 2 })) {
      pickup.taken = true;
      const before = state.score;
      state.score += PICKUP_POINTS;
      state.eraPickups++;
      events.push('collect');
      if (Math.floor(state.score / EXTRA_LIFE_POINTS) > Math.floor(before / EXTRA_LIFE_POINTS) && state.lives < MAX_LIVES) {
        state.lives++;
        events.push('extraLife');
        state.popups.push({ x: player.x + player.w / 2, y: player.y - 12, text: '+1 ♥', life: POPUP_LIFE });
      }
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
  for (const popup of state.popups) {
    popup.y -= 45 * dt;
    popup.life -= dt;
  }
  state.popups = state.popups.filter(p => p.life > 0);
  state.cameraX = Math.max(0, Math.min(WORLD_END - W, player.x - W * 0.32));

  if (state.phase !== 'playing') return events;
  if (state.checkpointX < CHECKPOINT_X && player.x >= CHECKPOINT_X) {
    state.checkpointX = CHECKPOINT_X;
    events.push('checkpoint');
  }
  // The prototype could overwrite a same-frame game over with an era clear; losing the last life wins.
  if (player.x + player.w >= WORLD_END - FINISH_MARGIN) {
    state.phase = 'clear';
    state.lastStars = starsFor(state.eraPickups, state.eraHits);
    events.push('clear');
    return events;
  }
  // Passed scare spots are used up even when scares are off, so turning them on never fires one behind you.
  let scared = false;
  while (state.scareTriggers.length && player.x >= state.scareTriggers[0]) {
    state.scareTriggers.shift();
    if (state.scaresEnabled && !scared) {
      state.scare = { kind: era.scare, t: 0 };
      events.push('scare');
      scared = true;
    }
  }
  return events;
}

/** 1 star for clearing the era, +1 for collecting at least STAR_PICKUPS pickups, +1 for taking no damage. */
export function starsFor(pickups: number, hits: number): number {
  return 1 + (pickups >= STAR_PICKUPS ? 1 : 0) + (hits === 0 ? 1 : 0);
}

/** Clamps a requestAnimationFrame delta exactly as the prototype did. */
export function frameDelta(timestamp: number, lastTime: number): number {
  return Math.min(0.033, Math.max(0, (timestamp - lastTime) / 1000 || 0));
}
