// Boss fights: pure state and rules (no drawing), so they can be unit tested.
// Every era ends with a boss. Each attack is announced by a clear warning (a "tell") so kids can
// learn it; after attacking, the boss is tired with its head down, and jumping on its head ("BONK!")
// is the only way to hit it. Beaten bosses run away; nothing is hurt in a gory way.
import { FLOOR, WORLD_END } from './config';

export type BossKind = 'trex' | 'mummy' | 'troll' | 'dragon' | 'kraken' | 'bull' | 'ghostking' | 'golem' | 'robot' | 'timeeater';
export type BossPhase = 'waiting' | 'intro' | 'idle' | 'telegraph' | 'recover' | 'tired' | 'hurt' | 'leaving';
/** stomp: a wave rolls along the ground (jump it). rain: objects fall where shadows appear (step away). volley: shots fly in low, high, low (jump the low ones). */
export type BossAttack = 'stomp' | 'rain' | 'volley';
export type BossEvent = 'bossRoar' | 'bossStomp' | 'bossHit' | 'bossDefeated';

export interface BossDef {
  name: string;
  hp: number;
  attacks: readonly BossAttack[];
}

export const BOSS_DEFS: Record<BossKind, BossDef> = {
  trex: { name: 'T-REX', hp: 3, attacks: ['stomp', 'rain'] },
  mummy: { name: 'GIANT MUMMY', hp: 3, attacks: ['rain', 'volley'] },
  troll: { name: 'FROST TROLL', hp: 3, attacks: ['stomp', 'rain'] },
  dragon: { name: 'DRAGON', hp: 3, attacks: ['volley', 'stomp'] },
  kraken: { name: 'KRAKEN', hp: 3, attacks: ['volley', 'rain'] },
  bull: { name: 'BANDIT BULL', hp: 4, attacks: ['stomp', 'volley'] },
  ghostking: { name: 'GHOST KING', hp: 4, attacks: ['volley', 'rain'] },
  golem: { name: 'STEAM GOLEM', hp: 4, attacks: ['stomp', 'rain'] },
  robot: { name: 'MEGA ROBOT', hp: 4, attacks: ['volley', 'rain'] },
  timeeater: { name: 'TIME EATER', hp: 5, attacks: ['stomp', 'rain', 'volley'] }
};

interface Box { x: number; y: number; w: number; h: number }
export interface Projectile extends Box {
  vx: number;
  vy: number;
  /** Seconds before it launches (volley shots leave the boss one after another). */
  delay: number;
}

export interface Boss extends Box {
  kind: BossKind;
  hp: number;
  phase: BossPhase;
  timer: number;
  attack: BossAttack;
  /** Index into the boss's attack rotation for the next attack. */
  attackIndex: number;
  /** Ground waves (stomp). */
  shockwaves: Projectile[];
  /** Falling objects (rain). */
  rocks: Projectile[];
  /** Flying shots (volley). */
  shots: Projectile[];
  /** Where rain will land, shown as shadows during the warning. */
  rockTargets: number[];
}

/** The arena starts here; the level layout keeps it free of other hazards and pits. */
export const BOSS_ARENA_X = WORLD_END - 760;
/** Seconds per phase at normal difficulty (hard is faster, easy slower, via the difficulty tempo). */
export const BOSS_TIMES = { intro: 1.2, idle: 1, telegraph: 0.9, recover: 0.5, tired: 2.2, hurt: 0.7, leaving: 1.6 } as const;
const SHOCKWAVE_SPEED = 300;
const SHOT_SPEED = 300;
const RAIN_GRAVITY = 1600;
const LEAVE_SPEED = 260;
/** Volley shots: low ones skim the ground (jump them); the high one passes over a standing player. */
const VOLLEY_HEIGHTS = [FLOOR - 26, FLOOR - 104, FLOOR - 26] as const;
const VOLLEY_GAP = 0.7;

export function createBoss(kind: BossKind): Boss {
  return {
    kind, x: WORLD_END - 300, y: FLOOR - 140, w: 150, h: 140, hp: BOSS_DEFS[kind].hp, phase: 'waiting', timer: 0,
    attack: BOSS_DEFS[kind].attacks[0], attackIndex: 0, shockwaves: [], rocks: [], shots: [], rockTargets: []
  };
}

export const bossBeaten = (boss: Boss | null) => !boss || boss.hp <= 0;

/** The head: high up while the boss stands, low and stompable while it is tired. */
export function headBox(boss: Boss): Box {
  return boss.phase === 'tired'
    ? { x: boss.x - 46, y: FLOOR - 62, w: 64, h: 26 }
    : { x: boss.x - 30, y: boss.y + 6, w: 70, h: 50 };
}

export function bodyBox(boss: Boss): Box {
  return { x: boss.x + 10, y: boss.y + 30, w: boss.w - 20, h: boss.h - 30 };
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export interface BossStepResult {
  events: BossEvent[];
  /** The player touched an attack or the boss's body. */
  hurtPlayer: boolean;
  /** The player stomped the boss's head and should bounce up. */
  bounce: boolean;
}

function launchAttack(boss: Boss): BossEvent | null {
  switch (boss.attack) {
    case 'stomp':
      boss.shockwaves.push({ x: boss.x - 44, y: FLOOR - 22, w: 44, h: 22, vx: -SHOCKWAVE_SPEED, vy: 0, delay: 0 });
      return 'bossStomp';
    case 'rain':
      boss.rocks.push(...boss.rockTargets.map(x => ({ x: x - 15, y: -40, w: 30, h: 30, vx: 0, vy: 0, delay: 0 })));
      boss.rockTargets = [];
      return null;
    case 'volley':
      boss.shots.push(...VOLLEY_HEIGHTS.map((y, i) => ({ x: boss.x - 40, y, w: 26, h: 18, vx: -SHOT_SPEED, vy: 0, delay: i * VOLLEY_GAP })));
      return 'bossRoar';
  }
}

/**
 * Advances the fight. `clockDt` drives timers and movement (0 while time is frozen); `tempo`
 * comes from the era and difficulty. Player contact is checked every call.
 */
export function updateBoss(boss: Boss, player: Box & { vy: number }, clockDt: number, tempo: number): BossStepResult {
  const events: BossEvent[] = [];
  const t = clockDt * tempo;
  const arenaRight = boss.x - 40;
  const attacks = BOSS_DEFS[boss.kind].attacks;

  switch (boss.phase) {
    case 'waiting':
      if (player.x + player.w >= BOSS_ARENA_X) {
        boss.phase = 'intro';
        boss.timer = BOSS_TIMES.intro;
        events.push('bossRoar');
      }
      break;
    case 'intro':
    case 'idle':
      boss.timer -= t;
      if (boss.timer <= 0) {
        boss.attack = attacks[boss.attackIndex % attacks.length];
        boss.attackIndex++;
        boss.phase = 'telegraph';
        boss.timer = BOSS_TIMES.telegraph;
        if (boss.attack === 'rain') {
          const center = player.x + player.w / 2;
          boss.rockTargets = [center, center - 130, center + 130].map(x => Math.min(arenaRight, Math.max(BOSS_ARENA_X + 20, x)));
        }
        events.push('bossRoar');
      }
      break;
    case 'telegraph':
      boss.timer -= t;
      if (boss.timer <= 0) {
        const launched = launchAttack(boss);
        if (launched) events.push(launched);
        boss.phase = 'recover';
        // Volleys take longer to cross the arena, so the boss waits for them before tiring.
        boss.timer = boss.attack === 'volley' ? BOSS_TIMES.recover + VOLLEY_GAP * 2 + 0.8 : BOSS_TIMES.recover;
      }
      break;
    case 'recover':
      boss.timer -= t;
      if (boss.timer <= 0) {
        boss.phase = 'tired';
        boss.timer = BOSS_TIMES.tired;
      }
      break;
    case 'tired':
      boss.timer -= t;
      if (boss.timer <= 0) {
        boss.phase = 'idle';
        boss.timer = BOSS_TIMES.idle;
      }
      break;
    case 'hurt':
      boss.timer -= t;
      if (boss.timer <= 0) {
        if (boss.hp <= 0) {
          boss.phase = 'leaving';
          boss.timer = BOSS_TIMES.leaving;
          events.push('bossDefeated');
        } else {
          boss.phase = 'idle';
          boss.timer = BOSS_TIMES.idle;
        }
      }
      break;
    case 'leaving':
      boss.x += LEAVE_SPEED * clockDt;
      break;
  }

  for (const wave of boss.shockwaves) wave.x += wave.vx * t;
  boss.shockwaves = boss.shockwaves.filter(wave => wave.x + wave.w > BOSS_ARENA_X - 300);
  for (const shot of boss.shots) {
    if (shot.delay > 0) shot.delay -= t;
    else shot.x += shot.vx * t;
  }
  boss.shots = boss.shots.filter(shot => shot.x + shot.w > BOSS_ARENA_X - 300);
  for (const rock of boss.rocks) {
    rock.vy += RAIN_GRAVITY * t;
    rock.y += rock.vy * t;
  }
  boss.rocks = boss.rocks.filter(rock => rock.y + rock.h < FLOOR);

  let hurtPlayer = false;
  let bounce = false;
  if (boss.phase === 'tired' && player.vy > 0 && overlaps(player, headBox(boss))) {
    boss.hp--;
    boss.phase = 'hurt';
    boss.timer = BOSS_TIMES.hurt;
    boss.shockwaves = [];
    boss.rocks = [];
    boss.shots = [];
    events.push('bossHit');
    bounce = true;
  } else if (boss.phase !== 'waiting' && boss.phase !== 'leaving' && boss.phase !== 'hurt') {
    const hitBox = (box: Box) => ({ x: box.x + 4, y: box.y + 3, w: box.w - 8, h: box.h - 5 });
    hurtPlayer =
      [...boss.shockwaves, ...boss.rocks, ...boss.shots].some(thing => thing.delay <= 0 && overlaps(player, hitBox(thing))) ||
      overlaps(player, bodyBox(boss));
  }
  return { events, hurtPlayer, bounce };
}
