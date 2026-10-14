import { GAME_RULES } from '@chronokid/shared';
import type { BossKind } from './boss';

export const W = 960;
export const H = 540;
export const FLOOR = 462;
export const WORLD_END = 3440;
export const START_X = 75;
export const CHECKPOINT_X = 1720;
export const START_LIVES = 3;
/** Shared with the API, which uses it to sanity-check submitted scores. */
export const PICKUP_POINTS = GAME_RULES.pickupPoints;
/** An extra life is awarded each time the score passes a multiple of this. */
export const EXTRA_LIFE_POINTS = 2000;
export const MAX_LIVES = 5;

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyRules {
  label: string;
  lives: number;
  /** Extra lives stop here. */
  maxLives: number;
  /** Multiplies how fast hazards move and blink. */
  tempo: number;
  /** Seconds of safety after a hit. */
  invulnerable: number;
  /** Whether runs on this difficulty are submitted to the leaderboard (Easy is not, to keep it fair). */
  leaderboard: boolean;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyRules> = {
  easy: { label: 'Easy', lives: 5, maxLives: 7, tempo: 0.75, invulnerable: 2, leaderboard: false },
  normal: { label: 'Normal', lives: START_LIVES, maxLives: MAX_LIVES, tempo: 1, invulnerable: 1.25, leaderboard: true },
  hard: { label: 'Hard', lives: 2, maxLives: 3, tempo: 1.25, invulnerable: 0.9, leaderboard: true }
};

export type Collectible = 'berry' | 'coin' | 'core' | 'gem' | 'star' | 'candy' | 'cog';
export type EraId = 'stone' | 'egypt' | 'viking' | 'medieval' | 'pirate' | 'west' | 'haunted' | 'steam' | 'future' | 'end';
export type ScareKind = 'trex' | 'mummy' | 'wolf' | 'dragon' | 'kraken' | 'train' | 'ghost' | 'steambot' | 'robot' | 'timeeater';

export type HazardKind = 'roller' | 'spikes' | 'flyer' | 'beam' | 'dropper' | 'projectile';

export interface HazardSkin {
  kind: HazardKind;
  w: number;
  h: number;
  /** Phase offset per hazard index, so neighbours move out of sync. */
  phaseStep: number;
  /** Flyers: hover height above the floor, and extra height per index (i % 3). */
  lift?: number;
  liftStep?: number;
}

export const SKINS = {
  boulder: { kind: 'roller', w: 38, h: 37, phaseStep: 1.7 },
  snowball: { kind: 'roller', w: 34, h: 34, phaseStep: 1.7 },
  barrel: { kind: 'roller', w: 34, h: 36, phaseStep: 1.5 },
  tumbleweed: { kind: 'roller', w: 36, h: 34, phaseStep: 1.9 },
  gear: { kind: 'roller', w: 40, h: 40, phaseStep: 1.6 },
  spikes: { kind: 'spikes', w: 48, h: 24, phaseStep: 0 },
  goldspikes: { kind: 'spikes', w: 48, h: 24, phaseStep: 0 },
  cactus: { kind: 'spikes', w: 30, h: 44, phaseStep: 0 },
  bat: { kind: 'flyer', w: 42, h: 28, phaseStep: 1.2, lift: 132, liftStep: 23 },
  drone: { kind: 'flyer', w: 38, h: 30, phaseStep: 1.4, lift: 126, liftStep: 24 },
  scarab: { kind: 'flyer', w: 32, h: 24, phaseStep: 1.3, lift: 112, liftStep: 20 },
  raven: { kind: 'flyer', w: 40, h: 26, phaseStep: 1.1, lift: 128, liftStep: 22 },
  seagull: { kind: 'flyer', w: 40, h: 22, phaseStep: 1.5, lift: 136, liftStep: 20 },
  // Ghosts swoop low enough to reach a standing player.
  ghost: { kind: 'flyer', w: 36, h: 40, phaseStep: 1.25, lift: 100, liftStep: 22 },
  laser: { kind: 'beam', w: 16, h: 84, phaseStep: 1.1 },
  flame: { kind: 'beam', w: 16, h: 70, phaseStep: 1.3 },
  steam: { kind: 'beam', w: 20, h: 90, phaseStep: 0.9 },
  icicle: { kind: 'dropper', w: 18, h: 34, phaseStep: 0 },
  chandelier: { kind: 'dropper', w: 44, h: 30, phaseStep: 0 },
  anvil: { kind: 'dropper', w: 34, h: 26, phaseStep: 0 },
  arrow: { kind: 'projectile', w: 30, h: 8, phaseStep: 0 },
  cannonball: { kind: 'projectile', w: 20, h: 20, phaseStep: 0 },
  minecart: { kind: 'projectile', w: 46, h: 30, phaseStep: 0 },
  plasma: { kind: 'projectile', w: 24, h: 14, phaseStep: 0 }
} satisfies Record<string, HazardSkin>;

export type SkinName = keyof typeof SKINS;

export interface Era {
  id: EraId;
  name: string;
  sky: string;
  skyBottom: string;
  ground: string;
  top: string;
  accent: string;
  /** Colour seen at the bottom of a pit. */
  pit: string;
  gravity: number;
  speed: number;
  jump: number;
  collectible: Collectible;
  /** Multiplies how fast hazards move and blink. */
  tempo: number;
  /** Hazards that sit or roll on the ground, placed between pits. */
  groundHazards: SkinName[];
  /** Flying, falling, and fired hazards, placed halfway between ground slots. */
  airHazards: SkinName[];
  /** Place an air hazard at every slot (1) or every other slot (2). */
  airEvery: 1 | 2;
  /** Fixed ground hazard positions; otherwise positions come from `spacing`. */
  hazardXs?: readonly number[];
  spacing: number;
  pits: number;
  pitWidth: number;
  /** Slippery footing: speed changes gradually. */
  ice?: boolean;
  /** Every other ledge crumbles shortly after it is stepped on. */
  crumble?: boolean;
  scare: ScareKind;
  scareXs: readonly number[];
  /** A boss guards the finish of this era (the arena at the end stays free of other hazards). */
  boss?: BossKind;
}

/** Original prototype hazard positions, kept for the first era. */
export const HAZARD_XS: readonly number[] = [520, 900, 1220, 1580, 1930, 2290, 2630, 2970, 3260];

export const ERAS: readonly Era[] = [
  { id: 'stone', name: 'STONE AGE', sky: '#bfd9bd', skyBottom: '#e0cba1', ground: '#514735', top: '#9a8153', accent: '#f5cd67', pit: '#231d14', gravity: 1900, speed: 245, jump: 650, collectible: 'berry', tempo: 1, groundHazards: ['boulder'], airHazards: [], airEvery: 2, hazardXs: HAZARD_XS, spacing: 0, pits: 0, pitWidth: 0, scare: 'trex', scareXs: [1050], boss: 'trex' },
  { id: 'egypt', name: 'ANCIENT EGYPT', sky: '#f4d7a1', skyBottom: '#f0b76e', ground: '#8a6236', top: '#e3b66b', accent: '#ffd75e', pit: '#3a2614', gravity: 1800, speed: 255, jump: 650, collectible: 'coin', tempo: 1.1, groundHazards: ['goldspikes'], airHazards: ['scarab', 'arrow'], airEvery: 2, spacing: 330, pits: 1, pitWidth: 72, crumble: true, scare: 'mummy', scareXs: [1050], boss: 'mummy' },
  { id: 'viking', name: 'VIKING AGE', sky: '#9fc0d8', skyBottom: '#e8f1f6', ground: '#56626e', top: '#eef6fb', accent: '#9ee7ff', pit: '#1c2833', gravity: 1700, speed: 270, jump: 640, collectible: 'gem', tempo: 1.15, groundHazards: ['snowball'], airHazards: ['icicle', 'raven'], airEvery: 2, spacing: 320, pits: 2, pitWidth: 78, ice: true, scare: 'wolf', scareXs: [1050, 2600], boss: 'troll' },
  { id: 'medieval', name: 'MEDIEVAL AGE', sky: '#b9c8d0', skyBottom: '#e0cba1', ground: '#4e4c50', top: '#aaa1a0', accent: '#ffcf5c', pit: '#1b1b22', gravity: 1600, speed: 285, jump: 660, collectible: 'coin', tempo: 1.2, groundHazards: ['spikes', 'flame'], airHazards: ['bat'], airEvery: 2, spacing: 300, pits: 2, pitWidth: 84, scare: 'dragon', scareXs: [1050, 2600], boss: 'dragon' },
  { id: 'pirate', name: 'PIRATE AGE', sky: '#79c2e3', skyBottom: '#f6d9a5', ground: '#6b4a2f', top: '#b07d4f', accent: '#ffd166', pit: '#1f5f86', gravity: 1700, speed: 290, jump: 670, collectible: 'coin', tempo: 1.25, groundHazards: ['barrel'], airHazards: ['cannonball', 'seagull'], airEvery: 2, spacing: 290, pits: 3, pitWidth: 88, scare: 'kraken', scareXs: [1050, 2600], boss: 'kraken' },
  { id: 'west', name: 'WILD WEST', sky: '#f5a86a', skyBottom: '#fde3b3', ground: '#94532f', top: '#d78f52', accent: '#ffe08a', pit: '#4a2412', gravity: 1650, speed: 300, jump: 665, collectible: 'star', tempo: 1.3, groundHazards: ['cactus', 'tumbleweed'], airHazards: ['minecart'], airEvery: 2, spacing: 280, pits: 3, pitWidth: 92, scare: 'train', scareXs: [1050, 2600], boss: 'bull' },
  { id: 'haunted', name: 'HAUNTED MANOR', sky: '#241d3a', skyBottom: '#4a3a5e', ground: '#2e2a35', top: '#6b5d7a', accent: '#c9a0ff', pit: '#0c0a12', gravity: 1600, speed: 295, jump: 660, collectible: 'candy', tempo: 1.35, groundHazards: ['spikes'], airHazards: ['ghost', 'chandelier'], airEvery: 1, spacing: 270, pits: 3, pitWidth: 94, crumble: true, scare: 'ghost', scareXs: [900, 2000, 2900], boss: 'ghostking' },
  { id: 'steam', name: 'STEAM AGE', sky: '#8d8775', skyBottom: '#d3bd8f', ground: '#4a3b2f', top: '#b5793d', accent: '#ffb347', pit: '#1d1712', gravity: 1500, speed: 310, jump: 650, collectible: 'cog', tempo: 1.4, groundHazards: ['steam', 'gear'], airHazards: ['anvil'], airEvery: 1, spacing: 260, pits: 4, pitWidth: 98, scare: 'steambot', scareXs: [1050, 2600], boss: 'golem' },
  { id: 'future', name: 'FUTURE AGE', sky: '#101c3c', skyBottom: '#203151', ground: '#263a58', top: '#32d9c1', accent: '#78f5e3', pit: '#070d1f', gravity: 1050, speed: 330, jump: 630, collectible: 'core', tempo: 1.45, groundHazards: ['laser'], airHazards: ['drone', 'plasma'], airEvery: 1, spacing: 250, pits: 4, pitWidth: 104, scare: 'robot', scareXs: [1050, 2600], boss: 'robot' },
  { id: 'end', name: 'END OF TIME', sky: '#1a0d2e', skyBottom: '#4a1d5c', ground: '#2b1d3a', top: '#ff5fa2', accent: '#ffe45e', pit: '#000000', gravity: 1250, speed: 320, jump: 640, collectible: 'core', tempo: 1.55, groundHazards: ['laser', 'boulder'], airHazards: ['ghost', 'cannonball', 'icicle'], airEvery: 1, spacing: 230, pits: 5, pitWidth: 108, crumble: true, scare: 'timeeater', scareXs: [700, 1900, 2900], boss: 'timeeater' }
];

export const LAST_ERA = ERAS.length - 1;

/** Elevated ledges as [x, y, width]. */
export const LEDGES: readonly (readonly [number, number, number])[] = [
  [370, 385, 145], [705, 340, 135], [1050, 390, 140], [1380, 330, 150], [1740, 385, 145], [2070, 340, 145], [2420, 385, 150], [2760, 330, 150], [3100, 380, 135]
];
