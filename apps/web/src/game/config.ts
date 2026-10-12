export const W = 960;
export const H = 540;
export const FLOOR = 462;
export const WORLD_END = 3440;
export const START_LIVES = 3;
export const PICKUP_POINTS = 100;

export type Collectible = 'berry' | 'coin' | 'core';

export interface Era {
  name: string;
  sky: string;
  far: string;
  near: string;
  ground: string;
  top: string;
  accent: string;
  gravity: number;
  speed: number;
  jump: number;
  collectible: Collectible;
}

export const ERAS: readonly Era[] = [
  { name: 'STONE AGE', sky: '#bfd9bd', far: '#729a76', near: '#426d56', ground: '#514735', top: '#9a8153', accent: '#f5cd67', gravity: 1900, speed: 245, jump: 650, collectible: 'berry' },
  { name: 'MEDIEVAL AGE', sky: '#b9c8d0', far: '#82959c', near: '#596e78', ground: '#4e4c50', top: '#aaa1a0', accent: '#ffcf5c', gravity: 1600, speed: 285, jump: 660, collectible: 'coin' },
  { name: 'FUTURE AGE', sky: '#101c3c', far: '#1d3963', near: '#216574', ground: '#263a58', top: '#32d9c1', accent: '#78f5e3', gravity: 1050, speed: 330, jump: 630, collectible: 'core' }
];

export const LAST_ERA = ERAS.length - 1;

/** Elevated ledges as [x, y, width]. */
export const LEDGES: readonly (readonly [number, number, number])[] = [
  [370, 385, 145], [705, 340, 135], [1050, 390, 140], [1380, 330, 150], [1740, 385, 145], [2070, 340, 145], [2420, 385, 150], [2760, 330, 150], [3100, 380, 135]
];

export const HAZARD_XS: readonly number[] = [520, 900, 1220, 1580, 1930, 2290, 2630, 2970, 3260];
