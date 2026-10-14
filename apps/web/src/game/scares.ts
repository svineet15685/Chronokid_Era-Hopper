// Spooky-silly jump scares: a cartoon creature pops up over the whole screen.
import type { ScareKind } from './config';
import { SCARE_TIME, type Scare } from './simulation';

const TAU = Math.PI * 2;

/** Pops in with an overshoot, rumbles, then shrinks away at the end. */
export function popScale(t: number, total: number): number {
  if (t < 0.12) return 0.3 + (t / 0.12) * 0.85;
  if (t < 0.22) return 1.15 - ((t - 0.12) / 0.1) * 0.15;
  const out = total - 0.25;
  if (t > out) return Math.max(0, 1 - (t - out) / 0.25);
  return 1 + Math.sin(t * 30) * 0.03;
}

/** Creatures are drawn around (0, 0) and fit roughly a 600 x 520 box. */
const CREATURE_W = 600;
const CREATURE_H = 520;

/** `still` draws the creature at full size without the pop-in and rumble (for reduced motion). */
export function drawScare(ctx: CanvasRenderingContext2D, kind: ScareKind, t: number, total: number, width: number, height: number, still = false): void {
  const fill = (color: string) => { ctx.fillStyle = color; };
  const circle = (x: number, y: number, r: number, color: string) => { fill(color); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const oval = (x: number, y: number, rx: number, ry: number, color: string) => { fill(color); ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };
  const poly = (color: string, ...p: number[]) => {
    fill(color); ctx.beginPath(); ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath(); ctx.fill();
  };
  const box = (x: number, y: number, w: number, h: number, color: string, r = 0) => { fill(color); ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); };
  const teeth = (x0: number, x1: number, y: number, size: number, down: boolean) => {
    for (let x = x0; x < x1 - size / 2; x += size) poly('#fffbea', x, y, x + size / 2, y + (down ? size : -size), x + size, y);
  };
  const eye = (x: number, y: number, r: number, iris: string) => { circle(x, y, r, iris); circle(x + r * 0.2, y, r * 0.45, '#111'); circle(x - r * 0.3, y - r * 0.35, r * 0.2, '#fff'); };

  const scale = still ? 1 : popScale(t, total);
  if (scale <= 0) return;
  ctx.save();
  const fit = Math.min(width / CREATURE_W, height / CREATURE_H) * 0.95;
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale * fit, scale * fit);

  switch (kind) {
    case 'trex':
      oval(30, 72, 125, 42, '#4d8a3d');
      poly('#7a1f2b', -110, 12, 140, 4, 128, 64, -70, 64);
      teeth(-100, 130, 64, 26, false);
      oval(0, -25, 155, 95, '#5c9e4a');
      teeth(-110, 120, 18, 28, true);
      for (const [sx, sy, sr] of [[60, -70, 12], [100, -30, 9], [20, -95, 8]]) circle(sx, sy, sr, '#76b85f');
      eye(-60, -55, 24, '#ffe066');
      poly('#3e6e33', -100, -88, -20, -80, -30, -66, -96, -74);
      circle(-135, -20, 7, '#2e4f26');
      break;
    case 'mummy':
      box(-230, 70, 150, 36, '#e8dfc8', 16); box(-210, 120, 130, 34, '#ddd2b6', 16);
      box(-100, -140, 200, 260, '#e8dfc8', 60);
      ctx.strokeStyle = '#c9bc9c'; ctx.lineWidth = 7;
      for (let y = -125; y < 120; y += 24) { ctx.beginPath(); ctx.moveTo(-98, y); ctx.lineTo(98, y + 14); ctx.stroke(); }
      box(-82, -66, 164, 42, '#2b2118', 10);
      circle(-38, -45, 14, '#ff3b3b'); circle(38, -45, 14, '#ff3b3b'); circle(-42, -49, 4, '#fff'); circle(34, -49, 4, '#fff');
      oval(0, 52, 40, 30 + Math.sin(t * 20) * 5, '#2b2118');
      ctx.strokeStyle = '#e8dfc8'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(90, -90);
      ctx.quadraticCurveTo(140, -100 + Math.sin(t * 18) * 20, 175, -60); ctx.stroke();
      break;
    case 'wolf':
      poly('#5c6370', -95, -80, -65, -175, -20, -100); poly('#5c6370', 95, -80, 65, -175, 20, -100);
      poly('#f4a6a6', -80, -95, -64, -150, -38, -105); poly('#f4a6a6', 80, -95, 64, -150, 38, -105);
      oval(0, -20, 125, 110, '#7b8494');
      poly('#5c6370', -125, 10, -160, 40, -110, 40); poly('#5c6370', 125, 10, 160, 40, 110, 40);
      oval(0, 55, 72, 52, '#c7ccd4');
      oval(0, 80, 40, 32, '#7a1f2b');
      poly('#fffbea', -26, 52, -16, 84, -6, 52); poly('#fffbea', 26, 52, 16, 84, 6, 52);
      oval(0, 18, 20, 13, '#1f2937');
      eye(-48, -38, 17, '#ffd23f'); eye(48, -38, 17, '#ffd23f');
      poly('#3f4550', -75, -66, -20, -52, -26, -42, -72, -54); poly('#3f4550', 75, -66, 20, -52, 26, -42, 72, -54);
      break;
    case 'dragon': {
      const flicker = Math.sin(t * 40) * 12;
      poly('#ff7a2f', -150, 40, -440, -60 + flicker, -440, 150 - flicker);
      poly('#ffd166', -150, 45, -400, -10 - flicker, -400, 100 + flicker);
      poly('#f4e1c1', 80, -55, 150, -175, 118, -45); poly('#f4e1c1', 30, -70, 58, -175, 72, -58);
      for (let i = 0; i < 4; i++) poly('#8e2a20', 110 + i * 28, -40 + i * 18, 150 + i * 28, -60 + i * 18, 136 + i * 28, -18 + i * 18);
      oval(20, 0, 150, 85, '#c0392b');
      oval(-95, 28, 85, 48, '#c0392b');
      oval(-70, 75, 95, 26, '#962d22');
      teeth(-160, -10, 70, 22, false);
      teeth(-165, -20, 50, 22, true);
      eye(20, -28, 21, '#ffe066');
      circle(-160, 10, 7, '#5a1a14');
      ctx.globalAlpha = 0.6; circle(-175, -20 - (t * 120) % 60, 14, '#9ca3af'); ctx.globalAlpha = 1;
      break;
    }
    case 'kraken':
      for (let i = 0; i < 6; i++) {
        const baseX = -260 + i * 104;
        ctx.strokeStyle = i % 2 ? '#8e44ad' : '#7d3c98'; ctx.lineCap = 'round';
        let px = baseX; let py = 260;
        for (let s = 1; s <= 10; s++) {
          const nx = baseX + Math.sin(t * 6 + i + s * 0.5) * (s * 6);
          const ny = 260 - s * (36 + (i % 3) * 6);
          ctx.lineWidth = 40 - s * 3; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(nx, ny); ctx.stroke();
          if (s % 2 === 0) circle(nx + 6, ny + 4, 5, '#e8b4f0');
          px = nx; py = ny;
        }
      }
      circle(0, -10, 74, '#7d3c98'); circle(0, -10, 62, '#f5f0ff'); circle(-8, -6, 40, '#ffcc33');
      box(-14, -40, 12, 68, '#111', 6); circle(-22, -26, 7, '#fff');
      break;
    case 'train': {
      const glow = ctx.createRadialGradient(0, -20, 30, 0, -20, 320);
      glow.addColorStop(0, '#fff6c2cc'); glow.addColorStop(1, '#fff6c200');
      fill('#000'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -20, 320, 0, TAU); ctx.fill();
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.7; circle(-10 + i * 30, -230 - i * 35 - (t * 80) % 30, 30 + i * 10, '#6b7280'); }
      ctx.globalAlpha = 1;
      box(-55, -215, 110, 22, '#1d1d20', 6); box(-40, -200, 80, 90, '#1d1d20');
      box(-155, -120, 310, 260, '#2d2d30', 30);
      circle(0, -25, 62, '#ffd54a'); circle(0, -25, 50, '#fff7c2');
      circle(-95, 60, 16, '#ff3b30'); circle(95, 60, 16, '#ff3b30');
      box(-80, 70, 160, 50, '#151517', 8);
      for (let x = -70; x < 80; x += 22) box(x, 76, 12, 38, '#c9c9c9', 2);
      poly('#b23a3a', -155, 140, 155, 140, 95, 215, -95, 215);
      for (let x = -120; x < 130; x += 36) poly('#7f2424', x, 140, x + 14, 140, x + 8, 212, x - 4, 212);
      break;
    }
    case 'ghost': {
      ctx.globalAlpha = 0.96; fill('#f4f0ff'); ctx.beginPath();
      ctx.arc(0, -40, 140, Math.PI, 0); ctx.lineTo(140, 170);
      for (let i = 6; i >= 0; i--) ctx.lineTo(-140 + i * (280 / 6), 170 - (i % 2 ? 34 : 0) + Math.sin(t * 12 + i) * 8);
      ctx.closePath(); ctx.fill();
      poly('#f4f0ff', -130, 10, -235, -120 + Math.sin(t * 14) * 10, -200, -138, -110, -40);
      poly('#f4f0ff', 130, 10, 235, -120 - Math.sin(t * 14) * 10, 200, -138, 110, -40);
      ctx.globalAlpha = 1;
      oval(-52, -52, 27, 40, '#1e1530'); oval(52, -52, 27, 40, '#1e1530');
      circle(-58, -66, 7, '#fff'); circle(46, -66, 7, '#fff');
      oval(0, 62, 40, 55 + Math.sin(t * 16) * 8, '#1e1530');
      oval(-95, 20, 18, 10, '#ffc4dd'); oval(95, 20, 18, 10, '#ffc4dd');
      break;
    }
    case 'steambot':
      for (const side of [-1, 1]) {
        box(side > 0 ? 140 : -185, -60, 45, 32, '#7a4f22', 4);
        ctx.globalAlpha = 0.75;
        for (let i = 0; i < 4; i++) circle(side * (200 + i * 34 + (t * 120) % 34), -46 - i * 12, 16 + i * 6, '#f2eee6');
        ctx.globalAlpha = 1;
      }
      box(-25, -195, 50, 70, '#7a4f22', 4);
      box(-140, -130, 280, 245, '#7a4f22', 18); box(-128, -118, 256, 221, '#b5793d', 12);
      for (let x = -115; x <= 115; x += 46) { circle(x, -105, 6, '#7a4f22'); circle(x, 90, 6, '#7a4f22'); }
      circle(-60, -35, 36, '#2b1d12'); circle(60, -35, 36, '#2b1d12');
      circle(-60, -35, 18 + Math.sin(t * 25) * 4, '#ff3b30'); circle(60, -35, 18 + Math.sin(t * 25) * 4, '#ff3b30');
      box(-92, 32, 184, 48, '#2b1d12', 6);
      for (let x = -80; x < 90; x += 24) box(x, 36, 10, 40, '#d9a066', 2);
      break;
    case 'robot': {
      const scan = -90 + ((t * 420) % 180);
      box(-6, -190, 12, 70, '#9aa9bd'); circle(0, -195, 14, Math.sin(t * 30) > 0 ? '#ff2d55' : '#ffd166');
      box(-145, -125, 290, 240, '#48d9cb', 44); box(-135, -115, 270, 220, '#2a3f5f', 38);
      box(-110, -72, 220, 62, '#0b1324', 30);
      ctx.globalAlpha = 0.5; circle(scan, -41, 36, '#ff2d55'); ctx.globalAlpha = 1; circle(scan, -41, 20, '#ff2d55');
      fill('#0b1324'); ctx.beginPath(); ctx.moveTo(-90, 40);
      for (let i = 0; i <= 9; i++) ctx.lineTo(-90 + i * 20, i % 2 ? 80 : 40);
      ctx.lineTo(90, 90); ctx.lineTo(-90, 90); ctx.closePath(); ctx.fill();
      teeth(-90, 90, 40, 20, true);
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) box(-170 + Math.sin(t * 50 + i) * 30, -100 + i * 80, 340, 8, i % 2 ? '#ff5fd2' : '#5ff5ff');
      ctx.globalAlpha = 1;
      break;
    }
    case 'timeeater':
      ctx.globalAlpha = 0.6; circle(0, -10, 205 + Math.sin(t * 10) * 10, '#5b2a7a'); ctx.globalAlpha = 1;
      circle(0, -20, 160, '#3d2457'); circle(0, -20, 146, '#f6e7c1');
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        box(Math.cos(a) * 128 - 5, -20 + Math.sin(a) * 128 - 5, 10, 10, '#3d2457', 2);
      }
      ctx.strokeStyle = '#3d2457'; ctx.lineCap = 'round';
      ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(Math.cos(t * 3) * 70, -20 + Math.sin(t * 3) * 70); ctx.stroke();
      ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(Math.cos(t * 14) * 110, -20 + Math.sin(t * 14) * 110); ctx.stroke();
      eye(-58, -78, 26, '#ff5fa2'); eye(58, -78, 26, '#ff5fa2');
      oval(0, 62, 95, 46, '#1a0d2e');
      teeth(-90, 90, 22, 24, true); teeth(-80, 80, 104, 22, false);
      break;
  }
  ctx.restore();

}

/** Draws scares on a viewport-sized canvas layered over the whole page; hidden when no scare is playing. */
/** Spooky scares start with a short blackout, then the creature appears on a darker, red-edged backdrop. */
const BLACKOUT = 0.3;

export function createScareLayer(canvas: HTMLCanvasElement, options: { reducedMotion?: () => boolean; spooky?: () => boolean } = {}): (scare: Scare | null) => void {
  const ctx = canvas.getContext('2d');
  return scare => {
    if (!scare || !ctx) {
      canvas.hidden = true;
      return;
    }
    canvas.hidden = false;
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 0.6 * Math.min(1, (SCARE_TIME - scare.t) / 0.25);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.globalAlpha = 1;
    const reduced = options.reducedMotion?.() ?? false;
    if (options.spooky?.()) {
      if (scare.t < BLACKOUT) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      ctx.globalAlpha = 0.85 * Math.min(1, (SCARE_TIME - scare.t) / 0.25);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
      drawScare(ctx, scare.kind, scare.t - BLACKOUT, SCARE_TIME - BLACKOUT, width, height, reduced);
      const edge = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.3, width / 2, height / 2, Math.max(width, height) * 0.7);
      edge.addColorStop(0, 'rgba(120, 0, 0, 0)');
      edge.addColorStop(1, 'rgba(120, 0, 0, 0.55)');
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, width, height);
      const redFlash = reduced ? 0 : Math.max(0, 0.45 - (scare.t - BLACKOUT) * 4);
      if (redFlash > 0) {
        ctx.globalAlpha = redFlash;
        ctx.fillStyle = '#b00000';
        ctx.fillRect(0, 0, width, height);
        ctx.globalAlpha = 1;
      }
      return;
    }
    drawScare(ctx, scare.kind, scare.t, SCARE_TIME, width, height, reduced);
    // No white flash for players who prefer reduced motion.
    const flash = reduced ? 0 : Math.max(0, 0.7 - scare.t * 5);
    if (flash > 0) {
      ctx.globalAlpha = flash;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;
    }
  };
}
