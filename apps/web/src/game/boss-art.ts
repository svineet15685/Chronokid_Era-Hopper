// Cartoon art for the ten era bosses and their attacks. Every boss shares one layout so the rules in
// boss.ts line up with the drawing: a body in the 150 x 140 box at (x, FLOOR - 140), a head up high
// while standing, and the head drooped to the ground in front while tired (where it can be stomped).
import type { BossKind, Projectile } from './boss';
import { FLOOR } from './config';

const TAU = Math.PI * 2;

export interface BossPose {
  tired: boolean;
  roaring: boolean;
  /** Pixels risen while winding up a stomp. */
  rear: number;
  /** White flash after a hit. */
  flash: boolean;
  /** Bounce while running away. */
  bob: number;
  time: number;
}

interface Paint {
  rect(x: number, y: number, w: number, h: number, color: string): void;
  circle(x: number, y: number, r: number, color: string): void;
  oval(x: number, y: number, rx: number, ry: number, color: string, rotation?: number): void;
  poly(color: string, ...p: number[]): void;
}

function painter(ctx: CanvasRenderingContext2D): Paint {
  return {
    rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
    circle(x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); },
    oval(x, y, rx, ry, color, rotation = 0) { ctx.fillStyle = color; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, TAU); ctx.fill(); },
    poly(color, ...p) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.closePath(); ctx.fill();
    }
  };
}

/** Where the head is: up high while standing, low in front while tired. */
export function headPosition(x: number, tired: boolean): { hx: number; hy: number } {
  return tired ? { hx: x - 14, hy: FLOOR - 49 } : { hx: x + 14, hy: FLOOR - 126 };
}

function teeth(p: Paint, x0: number, y: number, count: number, down = true): void {
  for (let i = 0; i < count; i++) p.poly('#fffbea', x0 + i * 10, y, x0 + 5 + i * 10, y + (down ? 8 : -8), x0 + 10 + i * 10, y);
}

/** Standard eyes; tired bosses get X eyes and dizzy stars from drawBoss. */
function eyes(p: Paint, hx: number, hy: number, iris: string, tired: boolean, ctx: CanvasRenderingContext2D): void {
  if (tired) {
    ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 3; ctx.beginPath();
    for (const ex of [hx - 4, hx + 14]) { ctx.moveTo(ex - 5, hy - 10); ctx.lineTo(ex + 5, hy - 2); ctx.moveTo(ex + 5, hy - 10); ctx.lineTo(ex - 5, hy - 2); }
    ctx.stroke();
    return;
  }
  p.circle(hx - 4, hy - 6, 6, iris); p.circle(hx + 14, hy - 6, 6, iris);
  p.rect(hx - 6, hy - 10, 3, 8, '#1a1a1a'); p.rect(hx + 12, hy - 10, 3, 8, '#1a1a1a');
}

type CreatureArt = (ctx: CanvasRenderingContext2D, p: Paint, x: number, pose: BossPose, flash: (color: string) => string) => void;

const neck = (p: Paint, x: number, color: string, tired: boolean) =>
  p.poly(color, x + 60, FLOOR - 112, x + 46, FLOOR - 70, tired ? x + 8 : x + 36, tired ? FLOOR - 40 : FLOOR - 104, tired ? x + 14 : x + 30, tired ? FLOOR - 60 : FLOOR - 132);

const CREATURES: Record<BossKind, CreatureArt> = {
  trex(ctx, p, x, pose, f) {
    const skin = f('#5c9e4a'); const dark = f('#4d8a3d');
    p.poly(dark, x + 140, FLOOR - 95, x + 205, FLOOR - 120, x + 210, FLOOR - 108, x + 140, FLOOR - 62);
    p.oval(x + 95, FLOOR - 80, 70, 46, skin, -0.15); p.oval(x + 80, FLOOR - 66, 40, 24, f('#a8d48a'), -0.15);
    p.rect(x + 66, FLOOR - 52, 22, 52, dark); p.rect(x + 104, FLOOR - 50, 22, 50, dark);
    p.rect(x + 36, FLOOR - 84, 16, 7, dark);
    neck(p, x, skin, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    const jaw = pose.roaring ? 16 : 4;
    p.oval(hx - 4, hy + 10, 34, 8 + jaw / 2, '#7a1f2b'); p.oval(hx - 2, hy + 14 + jaw, 34, 10, dark);
    p.oval(hx, hy, 40, 22, skin); teeth(p, hx - 34, hy + 14, 6);
    eyes(p, hx, hy, '#ffe066', pose.tired, ctx);
  },
  mummy(ctx, p, x, pose, f) {
    const wrap = f('#e8dfc8'); const line = '#c9bc9c';
    p.rect(x + 50, FLOOR - 120, 70, 120, wrap);
    for (let y = FLOOR - 116; y < FLOOR - 4; y += 14) p.rect(x + 50, y, 70, 4, line);
    p.rect(x + 30, FLOOR - 110, 22, 60, wrap); p.rect(x + 118, FLOOR - 110, 22, 60, wrap);
    p.rect(x + 60, FLOOR - 4, 22, 4, line); p.rect(x + 92, FLOOR - 4, 22, 4, line);
    neck(p, x, wrap, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.oval(hx, hy, 36, 28, wrap);
    for (let i = -2; i <= 2; i++) p.rect(hx - 34, hy + i * 9, 68, 3, line);
    p.rect(hx - 22, hy - 14, 50, 14, '#2b2118');
    if (pose.tired) eyes(p, hx, hy, '#ff3b3b', true, ctx); else { p.circle(hx - 4, hy - 7, 5, '#ff3b3b'); p.circle(hx + 14, hy - 7, 5, '#ff3b3b'); }
    if (pose.roaring) p.oval(hx + 4, hy + 12, 10, 8, '#2b2118');
  },
  troll(ctx, p, x, pose, f) {
    const fur = f('#d7ecf7'); const shade = f('#a9cfe3');
    p.oval(x + 92, FLOOR - 70, 66, 62, fur); p.oval(x + 92, FLOOR - 58, 40, 38, shade);
    p.rect(x + 56, FLOOR - 26, 28, 26, fur); p.rect(x + 104, FLOOR - 26, 28, 26, fur);
    p.oval(x + 28, FLOOR - 70, 16, 34, fur, 0.3);
    neck(p, x, fur, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.poly('#8c8f96', hx - 26, hy - 14, hx - 40, hy - 40, hx - 16, hy - 22); p.poly('#8c8f96', hx + 22, hy - 14, hx + 34, hy - 40, hx + 12, hy - 22);
    p.oval(hx, hy, 38, 26, fur);
    p.oval(hx + 2, hy + 14, 26, 12, pose.roaring ? '#2a4a63' : shade);
    p.poly('#fffbea', hx - 14, hy + 8, hx - 10, hy + 20, hx - 6, hy + 8); p.poly('#fffbea', hx + 12, hy + 8, hx + 16, hy + 20, hx + 20, hy + 8);
    eyes(p, hx, hy, '#4fc3f7', pose.tired, ctx);
  },
  dragon(ctx, p, x, pose, f) {
    const skin = f('#c0392b'); const dark = f('#962d22');
    p.poly(dark, x + 70, FLOOR - 110, x + 150, FLOOR - 190, x + 160, FLOOR - 120);
    p.poly(skin, x + 80, FLOOR - 110, x + 130, FLOOR - 175, x + 140, FLOOR - 118);
    p.poly(dark, x + 140, FLOOR - 92, x + 205, FLOOR - 118, x + 210, FLOOR - 104, x + 140, FLOOR - 60);
    p.oval(x + 95, FLOOR - 78, 68, 46, skin, -0.15); p.oval(x + 80, FLOOR - 64, 38, 22, f('#f4a582'), -0.15);
    p.rect(x + 66, FLOOR - 50, 22, 50, dark); p.rect(x + 104, FLOOR - 48, 22, 48, dark);
    neck(p, x, skin, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.poly('#f4e1c1', hx + 6, hy - 18, hx + 22, hy - 44, hx + 18, hy - 14); p.poly('#f4e1c1', hx - 10, hy - 18, hx - 4, hy - 42, hx + 2, hy - 16);
    if (pose.roaring) p.oval(hx - 30, hy + 10, 18, 10, '#ffb53c');
    p.oval(hx, hy, 40, 22, skin); teeth(p, hx - 34, hy + 12, 6);
    eyes(p, hx, hy, '#ffe066', pose.tired, ctx);
  },
  kraken(ctx, p, x, pose, f) {
    const skin = f('#8e44ad'); const light = f('#c39bd3');
    p.oval(x + 90, FLOOR + 4, 80, 14, '#1f5f86');
    for (let i = 0; i < 4; i++) {
      const tx = x + 40 + i * 30;
      const sway = Math.sin(pose.time * 3 + i) * 10;
      ctx.strokeStyle = skin; ctx.lineWidth = 14; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, FLOOR); ctx.quadraticCurveTo(tx + sway, FLOOR - 50, tx + 6 + sway, FLOOR - 90 - (i % 2) * 20); ctx.stroke();
      p.circle(tx + 4 + sway / 2, FLOOR - 40, 3, light);
    }
    p.oval(x + 100, FLOOR - 80, 52, 58, skin);
    neck(p, x, skin, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.oval(hx, hy, 40, 28, skin);
    p.oval(hx + 4, hy + 14, 14, pose.roaring ? 10 : 4, '#3a1450');
    eyes(p, hx, hy, '#ffcc33', pose.tired, ctx);
  },
  bull(ctx, p, x, pose, f) {
    const hide = f('#8b5a2b'); const dark = f('#5e3a1a');
    p.oval(x + 95, FLOOR - 74, 70, 48, hide);
    p.rect(x + 60, FLOOR - 40, 20, 40, dark); p.rect(x + 112, FLOOR - 40, 20, 40, dark);
    p.poly(dark, x + 160, FLOOR - 86, x + 190, FLOOR - 70, x + 186, FLOOR - 64);
    neck(p, x, hide, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.poly('#f4e1c1', hx - 30, hy - 12, hx - 50, hy - 34, hx - 22, hy - 20); p.poly('#f4e1c1', hx + 26, hy - 12, hx + 46, hy - 34, hx + 18, hy - 20);
    p.oval(hx, hy, 38, 26, hide);
    p.rect(hx - 30, hy - 14, 60, 12, '#1a1a1a');
    p.oval(hx - 4, hy + 14, 20, 10, f('#d9a27a'));
    p.circle(hx - 10, hy + 14, 3, '#3a2010'); p.circle(hx + 2, hy + 14, 3, '#3a2010');
    if (pose.roaring) p.poly('#9aa7b3', hx - 30, hy + 20, hx - 56, hy + 14, hx - 50, hy + 30);
    eyes(p, hx, hy, '#ffe066', pose.tired, ctx);
    p.poly('#c0392b', hx + 20, hy + 24, hx + 40, hy + 30, hx + 22, hy + 36);
  },
  ghostking(ctx, p, x, pose, f) {
    ctx.globalAlpha = 0.92;
    const sheet = f('#eef0ff');
    ctx.fillStyle = sheet; ctx.beginPath();
    ctx.moveTo(x + 30, FLOOR - 60); ctx.quadraticCurveTo(x + 95, FLOOR - 170, x + 160, FLOOR - 60);
    for (let i = 0; i <= 6; i++) ctx.lineTo(x + 160 - i * 22, FLOOR - 10 - (i % 2 ? 16 : 0) + Math.sin(pose.time * 6 + i) * 4);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    neck(p, x, sheet, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.oval(hx, hy, 38, 30, sheet);
    p.poly('#ffd447', hx - 26, hy - 24, hx - 26, hy - 46, hx - 14, hy - 34, hx, hy - 50, hx + 14, hy - 34, hx + 26, hy - 46, hx + 26, hy - 24);
    p.oval(hx + 4, hy + 14, 10, pose.roaring ? 12 : 6, '#2a1f3d');
    if (pose.tired) eyes(p, hx, hy, '#2a1f3d', true, ctx); else { p.oval(hx - 6, hy - 6, 7, 10, '#2a1f3d'); p.oval(hx + 16, hy - 6, 7, 10, '#2a1f3d'); }
  },
  golem(ctx, p, x, pose, f) {
    const brass = f('#b5793d'); const dark = f('#7a4f22');
    p.rect(x + 40, FLOOR - 120, 110, 90, brass); p.rect(x + 48, FLOOR - 112, 94, 74, f('#c98f4f'));
    for (let rx = x + 50; rx < x + 150; rx += 24) { p.circle(rx, FLOOR - 116, 3, dark); p.circle(rx, FLOOR - 34, 3, dark); }
    p.rect(x + 56, FLOOR - 30, 30, 30, dark); p.rect(x + 104, FLOOR - 30, 30, 30, dark);
    p.rect(x + 126, FLOOR - 150, 16, 32, dark);
    ctx.globalAlpha = 0.6; p.circle(x + 134, FLOOR - 160 - ((pose.time * 30) % 20), 10, '#f2eee6'); ctx.globalAlpha = 1;
    neck(p, x, dark, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.rect(hx - 34, hy - 22, 68, 44, brass);
    p.rect(hx - 24, hy + 8, 48, 10, '#2b1d12');
    for (let gx = hx - 20; gx < hx + 24; gx += 10) p.rect(gx, hy + 9, 4, 8, '#d9a066');
    eyes(p, hx, hy, pose.roaring ? '#ffd23f' : '#ff3b30', pose.tired, ctx);
  },
  robot(ctx, p, x, pose, f) {
    const steel = f('#5d6d7e'); const trim = f('#48d9cb');
    p.rect(x + 44, FLOOR - 124, 100, 86, steel); p.rect(x + 54, FLOOR - 114, 80, 20, trim);
    p.rect(x + 56, FLOOR - 38, 26, 38, steel); p.rect(x + 106, FLOOR - 38, 26, 38, steel);
    p.rect(x + 24, FLOOR - 104, 24, 50, steel); p.circle(x + 36, FLOOR - 50, 10, trim);
    neck(p, x, steel, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.rect(hx - 34, hy - 24, 68, 48, steel);
    p.rect(hx - 28, hy - 14, 56, 16, '#0b1324');
    if (!pose.tired) {
      const scan = Math.sin(pose.time * 4) * 18;
      p.circle(hx + scan, hy - 6, 6, pose.roaring ? '#ffd23f' : '#ff2d55');
    } else eyes(p, hx, hy, '#ff2d55', true, ctx);
    p.rect(hx - 2, hy - 38, 4, 14, steel); p.circle(hx, hy - 40, 4, Math.sin(pose.time * 10) > 0 ? '#ff2d55' : '#ffd166');
    p.rect(hx - 20, hy + 10, 40, 6, trim);
  },
  timeeater(ctx, p, x, pose, f) {
    const rim = f('#3d2457'); const face = f('#f6e7c1');
    p.circle(x + 96, FLOOR - 74, 66, rim); p.circle(x + 96, FLOOR - 74, 56, face);
    ctx.strokeStyle = rim; ctx.lineWidth = 6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + 96, FLOOR - 74); ctx.lineTo(x + 96 + Math.cos(pose.time * 3) * 40, FLOOR - 74 + Math.sin(pose.time * 3) * 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 96, FLOOR - 74); ctx.lineTo(x + 96 + Math.cos(pose.time) * 26, FLOOR - 74 + Math.sin(pose.time) * 26); ctx.stroke();
    p.rect(x + 66, FLOOR - 14, 18, 14, rim); p.rect(x + 108, FLOOR - 14, 18, 14, rim);
    neck(p, x, rim, pose.tired);
    const { hx, hy } = headPosition(x, pose.tired);
    p.circle(hx, hy, 32, rim); p.circle(hx, hy, 26, face);
    p.oval(hx + 2, hy + 12, 20, pose.roaring ? 10 : 6, '#1a0d2e'); teeth(p, hx - 16, hy + 8, 4);
    eyes(p, hx, hy, '#ff5fa2', pose.tired, ctx);
  }
};

function star(p: Paint, x: number, y: number, r: number, color: string): void {
  const points: number[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 ? r * 0.45 : r;
    points.push(x + Math.cos(-Math.PI / 2 + (i * Math.PI) / 5) * radius, y + Math.sin(-Math.PI / 2 + (i * Math.PI) / 5) * radius);
  }
  p.poly(color, ...points);
}

/** The boss itself, in screen coordinates (`x` is already camera-adjusted). */
export function drawBossCreature(ctx: CanvasRenderingContext2D, kind: BossKind, x: number, pose: BossPose, reduced: boolean): void {
  const p = painter(ctx);
  const flash = (color: string) => (pose.flash ? '#ffffff' : color);
  ctx.save();
  ctx.translate(0, -pose.rear - pose.bob);
  CREATURES[kind](ctx, p, x, pose, flash);
  if (pose.tired) {
    const { hx, hy } = headPosition(x, true);
    for (let i = 0; i < 3; i++) {
      const a = (reduced ? 0 : pose.time * 4) + (i * TAU) / 3;
      star(p, hx + Math.cos(a) * 30, hy - 38 + Math.sin(a) * 9, 10, '#ffe14d');
    }
  }
  ctx.restore();
}

const WAVE_COLORS: Partial<Record<BossKind, string>> = { troll: '#bdefff', dragon: '#ff8a3d', golem: '#f2eee6', timeeater: '#ff5fa2' };

/** Ground waves, falling objects, and flying shots, themed per boss. */
export function drawBossAttacks(ctx: CanvasRenderingContext2D, kind: BossKind, waves: Projectile[], rain: Projectile[], shots: Projectile[], cameraX: number, time: number): void {
  const p = painter(ctx);
  const waveColor = WAVE_COLORS[kind] ?? '#b08a5a';
  for (const wave of waves) {
    const wx = wave.x - cameraX;
    ctx.fillStyle = waveColor; ctx.beginPath(); ctx.ellipse(wx + wave.w / 2, FLOOR, wave.w / 2 + 6, wave.h, 0, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = '#ffffffaa'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(wx + 8 + i * 12, FLOOR - 4); ctx.lineTo(wx + 14 + i * 12, FLOOR - wave.h + 4); ctx.stroke(); }
  }
  for (const thing of rain) {
    const cx = thing.x + thing.w / 2 - cameraX;
    const cy = thing.y + thing.h / 2;
    switch (kind) {
      case 'mummy': p.rect(cx - 15, cy - 15, 30, 30, '#d9b26b'); p.rect(cx - 15, cy - 2, 30, 3, '#a8834a'); break;
      case 'troll': p.poly('#bdf1ff', cx - 12, cy - 15, cx + 12, cy - 15, cx, cy + 16); break;
      case 'kraken': p.rect(cx - 13, cy - 15, 26, 30, '#8b5a2b'); p.rect(cx - 13, cy - 8, 26, 3, '#3d3d3d'); p.rect(cx - 13, cy + 5, 26, 3, '#3d3d3d'); break;
      case 'ghostking': p.rect(cx - 15, cy - 4, 30, 5, '#c9a24a'); for (let i = 0; i < 3; i++) p.circle(cx - 10 + i * 10, cy - 8, 3, '#ffb53c'); p.poly('#c9a24a', cx - 8, cy + 1, cx + 8, cy + 1, cx, cy + 14); break;
      case 'golem': p.circle(cx, cy, 14, '#b5793d'); p.circle(cx, cy, 5, '#4a3b2f'); break;
      case 'robot': ctx.globalAlpha = 0.4; p.circle(cx + 6, cy - 14, 10, '#ff8a3d'); ctx.globalAlpha = 1; p.circle(cx, cy, 14, '#6f5a52'); p.circle(cx - 4, cy - 4, 5, '#ff8a3d'); break;
      case 'timeeater': p.circle(cx, cy, 14, '#3d2457'); p.circle(cx, cy, 11, '#f6e7c1'); p.rect(cx - 1, cy - 8, 2, 8, '#3d2457'); break;
      default: p.circle(cx, cy, 15, '#6f6a62'); p.circle(cx - 5, cy - 5, 5, '#9a958c');
    }
  }
  for (const shot of shots) {
    if (shot.delay > 0) continue;
    const cx = shot.x + shot.w / 2 - cameraX;
    const cy = shot.y + shot.h / 2;
    switch (kind) {
      case 'mummy': p.oval(cx, cy, 13, 9, '#1f6f6b'); p.rect(cx - 1, cy - 8, 2, 16, '#0e3a38'); break;
      case 'dragon': ctx.globalAlpha = 0.5; p.oval(cx + 10, cy, 18, 9, '#ff8a3d'); ctx.globalAlpha = 1; p.circle(cx, cy, 10, '#ffd166'); break;
      case 'kraken': p.oval(cx, cy, 13, 10, '#3a1450'); p.circle(cx + 6, cy - 4, 4, '#6b2f8a'); break;
      case 'bull': ctx.strokeStyle = '#a7834d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 11, time * 6, time * 6 + 5); ctx.stroke(); break;
      case 'ghostking': ctx.globalAlpha = 0.5; p.circle(cx, cy, 14, '#e8eaff'); ctx.globalAlpha = 1; p.circle(cx, cy, 8, '#ffffff'); break;
      case 'robot': ctx.globalAlpha = 0.4; p.oval(cx + 10, cy, 20, 10, '#ff5fd2'); ctx.globalAlpha = 1; p.oval(cx, cy, 12, 7, '#ffd0f3'); break;
      default: p.circle(cx, cy, 11, '#ffe45e'); p.circle(cx, cy, 5, '#ff5fa2');
    }
  }
}
