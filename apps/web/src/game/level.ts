// Deterministic level layouts: where pits and hazards go in each era.
import { CHECKPOINT_X, WORLD_END, type Era, type SkinName } from './config';

/** Keep the start, checkpoint, and finish areas free of pits and hazards. */
export const START_SAFE = 430;
export const FINISH_SAFE = WORLD_END - 300;
export const CHECKPOINT_SAFE = 160;

export interface Pit { x: number; w: number }
export interface HazardSlot { x: number; skin: SkinName }
export interface Layout { pits: Pit[]; hazards: HazardSlot[] }

const inSafeZone = (x: number) => x < START_SAFE || x > FINISH_SAFE || Math.abs(x - CHECKPOINT_X) <= CHECKPOINT_SAFE;

export function levelLayout(era: Era): Layout {
  const groundSkin = (i: number) => era.groundHazards[i % era.groundHazards.length];
  if (era.hazardXs) return { pits: [], hazards: era.hazardXs.map((x, i) => ({ x, skin: groundSkin(i) })) };

  // Ground slots are evenly spaced; some become pits and the rest get ground hazards.
  const slots: number[] = [];
  for (let x = START_SAFE + 60; x < FINISH_SAFE; x += era.spacing) if (!inSafeZone(x)) slots.push(x);
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
