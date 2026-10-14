// Deterministic level layouts: where pits and hazards go in each era.
import { BOSS_ARENA_X } from './boss';
import { CHECKPOINT_X, WORLD_END, type Era, type SkinName } from './config';

/** Keep the start, checkpoint, and finish areas free of pits and hazards. */
export const START_SAFE = 430;
export const FINISH_SAFE = WORLD_END - 300;
export const CHECKPOINT_SAFE = 160;

export interface Pit { x: number; w: number }
export interface HazardSlot { x: number; skin: SkinName }
export interface Layout { pits: Pit[]; hazards: HazardSlot[] }


/** Rolling hazards near the arena could sway into it, so boss eras keep this much extra room. */
const ARENA_MARGIN = 160;
const clearOfArena = (x: number) => x < BOSS_ARENA_X - ARENA_MARGIN;

/** Pits and hazards stop before the boss arena (or the finish area in eras without a boss). */
const layoutEnd = (era: Era) => (era.boss ? BOSS_ARENA_X - ARENA_MARGIN : FINISH_SAFE);

export function levelLayout(era: Era): Layout {
  const layout = baseLayout(era);
  if (!era.boss) return layout;
  return { pits: layout.pits.filter(pit => clearOfArena(pit.x + pit.w)), hazards: layout.hazards.filter(hazard => clearOfArena(hazard.x)) };
}

function baseLayout(era: Era): Layout {
  const groundSkin = (i: number) => era.groundHazards[i % era.groundHazards.length];
  const end = layoutEnd(era);
  const inSafeZone = (x: number) => x < START_SAFE || x > end || Math.abs(x - CHECKPOINT_X) <= CHECKPOINT_SAFE;
  if (era.hazardXs) return { pits: [], hazards: era.hazardXs.map((x, i) => ({ x, skin: groundSkin(i) })) };

  // Ground slots are evenly spaced; some become pits and the rest get ground hazards.
  const slots: number[] = [];
  // Leave room for a pit's width before the end, so pits never reach into the arena or finish area.
  for (let x = START_SAFE + 60; x < end - era.pitWidth / 2; x += era.spacing) if (!inSafeZone(x)) slots.push(x);
  const pitSlots = new Set(Array.from({ length: era.pits }, (_, k) => Math.floor(((k + 0.5) * slots.length) / era.pits)));
  const pits: Pit[] = [];
  const ground: HazardSlot[] = [];
  slots.forEach((x, i) => {
    if (pitSlots.has(i)) pits.push({ x: x - era.pitWidth / 2, w: era.pitWidth });
    else ground.push({ x, skin: groundSkin(ground.length) });
  });

  // Air hazards sit halfway between ground slots, so they never share a spot with a ground hazard.
  const air: HazardSlot[] = [];
  slots.forEach((slot, i) => {
    const x = slot + era.spacing / 2;
    if (i % era.airEvery === 0 && !inSafeZone(x) && era.airHazards.length) air.push({ x, skin: era.airHazards[air.length % era.airHazards.length] });
  });
  return { pits, hazards: [...ground, ...air].sort((a, b) => a.x - b.x) };
}
