// Chronokid's look: the blocky hero plus unlockable outfits. Shared by the game and the wardrobe previews.
// Coordinates are local to the hero's 32 x 44 box (x from 0, the head's top at `y`); callers translate and flip.

export type OutfitId = 'classic' | 'caveman' | 'pharaoh' | 'viking' | 'pirate' | 'pumpkin' | 'cowboy' | 'vampire' | 'astronaut' | 'crown';

export interface Outfit {
  id: OutfitId;
  name: string;
  /** Total best stars across all eras needed to unlock it (30 is every star). */
  stars: number;
}

export const OUTFITS: readonly Outfit[] = [
  { id: 'classic', name: 'Classic', stars: 0 },
  { id: 'caveman', name: 'Caveman Bone Helmet', stars: 3 },
  { id: 'pharaoh', name: 'Pharaoh Headdress', stars: 6 },
  { id: 'viking', name: 'Viking Horns', stars: 9 },
  { id: 'pirate', name: 'Pirate Hat and Eyepatch', stars: 12 },
  { id: 'pumpkin', name: 'Pumpkin Head', stars: 14 },
  { id: 'cowboy', name: 'Cowboy Hat', stars: 17 },
  { id: 'vampire', name: 'Vampire Cape', stars: 20 },
  { id: 'astronaut', name: 'Astronaut Helmet', stars: 24 },
  { id: 'crown', name: 'Golden Crown', stars: 30 }
];

export const isOutfitId = (value: unknown): value is OutfitId => OUTFITS.some(o => o.id === value);

export const outfitUnlocked = (outfit: Outfit, totalStars: number) => totalStars >= outfit.stars;

/** Outfits whose star requirement was crossed when the total went from `before` to `after`. */
export function newlyUnlocked(before: number, after: number): Outfit[] {
  return OUTFITS.filter(o => o.stars > before && o.stars <= after);
}

export interface HeroPose {
  outfit: OutfitId;
  armsUp: boolean;
}

export function drawHero(ctx: CanvasRenderingContext2D, y: number, pose: HeroPose): void {
  const rect = (x: number, top: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(top), Math.round(w), Math.round(h));
  };
  const poly = (color: string, ...p: number[]) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath(); ctx.fill();
  };
  const circle = (x: number, cy: number, r: number, color: string) => {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, cy, r, 0, Math.PI * 2); ctx.fill();
  };
  const { outfit } = pose;

  // Behind the body.
  if (outfit === 'vampire') {
    poly('#2a0a14', 6, y + 18, 30, y + 18, 36, y + 44, 0, y + 44);
    poly('#9b1b2e', 9, y + 20, 27, y + 20, 31, y + 42, 5, y + 42);
  }

  // Tiny time-traveler silhouette, intentionally built from crisp canvas blocks.
  rect(7, y + 1, 20, 17, '#f2c36b');
  rect(11, y + 5, 3, 3, '#172d36'); rect(22, y + 5, 3, 3, '#172d36');
  rect(9, y + 18, 19, 16, '#2e9a91');
  if (pose.armsUp) { rect(3, y + 8, 6, 12, '#eaa959'); rect(28, y + 8, 6, 12, '#eaa959'); }
  else { rect(3, y + 19, 8, 6, '#eaa959'); rect(27, y + 20, 7, 6, '#eaa959'); }
  rect(10, y + 33, 7, 10, '#e8b85e'); rect(21, y + 33, 7, 10, '#e8b85e');
  rect(8, y + 41, 10, 3, '#30404b'); rect(20, y + 41, 11, 3, '#30404b');

  // Headwear (the classic look keeps its teal time-traveler cap).
  switch (outfit) {
    case 'classic':
      rect(9, y - 2, 18, 4, '#415b64'); rect(13, y - 6, 11, 4, '#5fe2cb');
      break;
    case 'caveman':
      rect(7, y - 4, 20, 6, '#e9dfc7'); rect(10, y - 3, 3, 2, '#c9bc9c'); rect(20, y - 2, 4, 2, '#c9bc9c');
      circle(5, y - 2, 3, '#f4ecd9'); circle(5, y + 2, 3, '#f4ecd9');
      circle(29, y - 2, 3, '#f4ecd9'); circle(29, y + 2, 3, '#f4ecd9');
      break;
    case 'pharaoh':
      rect(5, y - 5, 24, 8, '#e7b93e');
      for (let x = 7; x < 28; x += 5) rect(x, y - 5, 2, 8, '#2457a6');
      rect(4, y + 3, 5, 15, '#e7b93e'); rect(25, y + 3, 5, 15, '#e7b93e');
      for (let s = y + 5; s < y + 18; s += 4) { rect(4, s, 5, 2, '#2457a6'); rect(25, s, 5, 2, '#2457a6'); }
      circle(17, y - 5, 2.5, '#2fb57a');
      break;
    case 'viking':
      rect(7, y - 4, 20, 7, '#8c8f96'); rect(16, y - 4, 2, 7, '#6b6e75');
      poly('#f4ecd9', 8, y - 1, 1, y - 12, 4, y - 12, 11, y - 3);
      poly('#f4ecd9', 26, y - 1, 33, y - 12, 30, y - 12, 23, y - 3);
      break;
    case 'pirate':
      poly('#1d1d22', 2, y + 1, 32, y + 1, 26, y - 8, 17, y - 4, 8, y - 8);
      circle(17, y - 2, 2.5, '#f4f4f4');
      rect(19, y + 4, 8, 5, '#111111'); rect(8, y + 4, 12, 1, '#111111');
      break;
    case 'pumpkin':
      circle(17, y + 9, 12, '#ff8a1e'); circle(11, y + 9, 9, '#f07812'); circle(23, y + 9, 9, '#f07812'); circle(17, y + 9, 9, '#ff8a1e');
      rect(15, y - 5, 4, 5, '#4f7a2a');
      poly('#2a1405', 10, y + 9, 13, y + 4, 15, y + 9); poly('#2a1405', 19, y + 9, 22, y + 4, 24, y + 9);
      poly('#2a1405', 10, y + 13, 24, y + 13, 22, y + 17, 19, y + 15, 17, y + 17, 15, y + 15, 12, y + 17);
      break;
    case 'cowboy':
      rect(0, y - 1, 34, 4, '#8b5a2b');
      rect(9, y - 10, 16, 10, '#a0703a'); rect(9, y - 4, 16, 2, '#4a2a12');
      break;
    case 'vampire':
      rect(7, y - 2, 20, 4, '#1a1a22');
      poly('#2a0a14', 6, y + 18, 3, y + 10, 10, y + 16); poly('#2a0a14', 28, y + 18, 31, y + 10, 24, y + 16);
      poly('#ffffff', 13, y + 13, 14, y + 16, 15, y + 13); poly('#ffffff', 19, y + 13, 20, y + 16, 21, y + 13);
      break;
    case 'astronaut':
      ctx.globalAlpha = 0.28; circle(17, y + 8, 15, '#9fd8ff'); ctx.globalAlpha = 1;
      ctx.strokeStyle = '#f4f7fb'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(17, y + 8, 15, 0, Math.PI * 2); ctx.stroke();
      rect(16, y - 12, 2, 6, '#c9d2dc'); circle(17, y - 13, 2.5, '#ff5b5b');
      break;
    case 'crown':
      poly('#ffd447', 7, y + 1, 7, y - 7, 11, y - 2, 17, y - 10, 23, y - 2, 27, y - 7, 27, y + 1);
      circle(17, y - 3, 2, '#e8344e'); circle(11, y - 1, 1.5, '#2fb5e8'); circle(23, y - 1, 1.5, '#2fb57a');
      break;
  }
}
