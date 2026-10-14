// The intro story: four short comic panels drawn in the game's blocky style.
// Shown once on first launch (remembered on the device) and replayable from the start screen.
import { ERAS } from '../game/config';
import { drawHero } from '../game/hero';

export const INTRO_CAPTIONS = [
  'Chronokid built a time machine!',
  'ZAP! Something went wrong…',
  'The pieces flew across 10 ages of history!',
  'Hop through every era and fix the timeline!'
] as const;

const SEEN_KEY = 'chronokid.introSeen';

export function introSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === 'yes';
  } catch {
    return true; // without storage, do not show it on every visit
  }
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, 'yes');
  } catch {
    /* not persisted */
  }
}

const W = 480;
const H = 270;
const FLOOR = 228;

/** Draws one panel; `time` (seconds) animates sparks and lights unless `still` is set. */
export function drawIntroPanel(ctx: CanvasRenderingContext2D, index: number, time: number, still = false): void {
  const t = still ? 0 : time;
  const rect = (x: number, y: number, w: number, h: number, color: string) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const circle = (x: number, y: number, r: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  const hero = (x: number, y: number, scale: number, armsUp: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    drawHero(ctx, 0, { outfit: 'classic', armsUp });
    ctx.restore();
  };
  const machine = (x: number, broken: boolean) => {
    rect(x, FLOOR - 120, 110, 120, broken ? '#4a4f5c' : '#5c6b8a');
    rect(x + 10, FLOOR - 110, 90, 50, '#1b2333');
    for (let i = 0; i < 3; i++) {
      const on = still || Math.floor(t * 4 + i) % 2 === 0;
      circle(x + 28 + i * 27, FLOOR - 85, 8, broken ? '#ff5b5b' : on ? '#78f5e3' : '#2c6b65');
    }
    rect(x + 20, FLOOR - 50, 70, 10, '#ffd447');
    rect(x + 45, FLOOR - 150, 20, 30, '#8a98b8');
    circle(x + 55, FLOOR - 155, 10, broken ? '#ff8066' : '#c6f36b');
  };

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, index === 2 ? '#1a0d2e' : '#2b3b55');
  sky.addColorStop(1, index === 2 ? '#4a1d5c' : '#5d6f8f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  if (index !== 2) {
    rect(0, FLOOR, W, H - FLOOR, '#3b3530');
    rect(0, FLOOR, W, 6, '#6b5d4a');
  }

  if (index === 0) {
    // The garage workshop: a shiny new machine.
    rect(30, 40, 70, 50, '#3d4c66'); rect(36, 46, 58, 38, '#8fb3d9');
    machine(250, false);
    hero(150, FLOOR - 66, 1.5, false);
    for (let i = 0; i < 4; i++) circle(250 + 20 + i * 24, FLOOR - 170 - Math.sin(t * 3 + i) * 6, 3, '#fff6c2');
  } else if (index === 1) {
    // ZAP: lightning, sparks, and a very surprised hero.
    machine(250, true);
    ctx.strokeStyle = '#ffe14d'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
    for (let b = 0; b < 3; b++) {
      ctx.beginPath();
      ctx.moveTo(305, FLOOR - 150);
      let x = 305; let y = FLOOR - 150;
      for (let s = 0; s < 4; s++) { x += (b - 1) * 26 + Math.sin(t * 20 + s + b) * 8; y -= 22; ctx.lineTo(x + (s % 2 ? 12 : -12), y); }
      ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 0.45 + t * 2;
      circle(305 + Math.cos(a) * (60 + (i % 3) * 18), FLOOR - 120 + Math.sin(a) * 40, 3, i % 2 ? '#ff8066' : '#ffe14d');
    }
    hero(110, FLOOR - 66 - (still ? 10 : Math.abs(Math.sin(t * 6)) * 14), 1.5, true);
    ctx.font = '900 34px "Trebuchet MS", sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#1a1a1a'; ctx.fillStyle = '#ffe14d';
    ctx.strokeText('ZAP!', 360, 70); ctx.fillText('ZAP!', 360, 70);
  } else if (index === 2) {
    // The timeline: ten glowing stops along a winding path.
    ctx.strokeStyle = '#f6e7c1aa'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]); ctx.beginPath();
    ERAS.forEach((_, i) => {
      const x = 40 + i * 44; const y = 140 + Math.sin(i * 1.3) * 60;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke(); ctx.setLineDash([]);
    ERAS.forEach((era, i) => {
      const x = 40 + i * 44; const y = 140 + Math.sin(i * 1.3) * 60;
      const pulse = still ? 0 : Math.sin(t * 4 + i) * 2;
      ctx.globalAlpha = 0.35; circle(x, y, 18 + pulse, era.accent); ctx.globalAlpha = 1;
      circle(x, y, 11, era.accent);
      ctx.fillStyle = '#1a0d2e'; ctx.font = '900 11px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), x, y + 4);
    });
    ctx.textAlign = 'start';
    for (let i = 0; i < 6; i++) rect(60 + i * 70 + (still ? 0 : Math.sin(t * 2 + i) * 6), 30 + (i % 3) * 18, 10, 10, '#8a98b8');
  } else {
    // Off to fix the timeline!
    rect(380, FLOOR - 120, 6, 120, '#d9e7c9');
    ctx.fillStyle = '#c6f36b'; ctx.beginPath(); ctx.moveTo(386, FLOOR - 118); ctx.lineTo(440, FLOOR - 100); ctx.lineTo(386, FLOOR - 82); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 5; i++) circle(160 + i * 45, FLOOR - 70 - (i % 2) * 20 + (still ? 0 : Math.sin(t * 4 + i) * 4), 7, '#ffd447');
    hero(60 + (still ? 0 : (t * 40) % 60), FLOOR - 66, 1.5, false);
  }
  ctx.restore();
}
