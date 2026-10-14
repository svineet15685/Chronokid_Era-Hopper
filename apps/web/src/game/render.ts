// Canvas drawing. Stone, Medieval, and Future art is ported unchanged from the prototype.
// Jump scare creatures are drawn full screen by scares.ts; the game view only shakes.
import { CHECKPOINT_X, ERAS, FLOOR, H, W, WORLD_END, type Era } from './config';
import { drawHero, type OutfitId } from './hero';
import { DOUBLE_JUMP_TIME, FREEZE_TIME, MAGNET_TIME, PARTICLE_LIFE, POPUP_LIFE, POWER_UP_SIZE, type GameState, type Hazard, type Platform, type PowerKind } from './simulation';

const POWER_COLORS: Record<PowerKind, string> = { shield: '#6fd3ff', freeze: '#b8f1ff', magnet: '#ff6f7d', doubleJump: '#ffd84d' };

const TAU = Math.PI * 2;
/** Droppers start wobbling when the player is this close. */
const DROPPER_WARN = 260;
/** Wraps a parallax position into [-margin, W + span - margin). */
const wrap = (value: number, span: number, margin: number) => ((value % (W + span)) + W + span) % (W + span) - margin;

export interface RenderOptions {
  /** When true (the player prefers reduced motion), scares do not shake the screen and the hero does not dance. */
  reducedMotion?: () => boolean;
  /** Spooky mode: darkness with a glow around the hero, fog, and eyes watching from the background. */
  spooky?: () => boolean;
  /** The outfit Chronokid is wearing. */
  outfit?: () => OutfitId;
}

export function createRenderer(ctx: CanvasRenderingContext2D, options: RenderOptions = {}): (state: GameState, time?: number) => void {
  function rect(x: number, y: number, w: number, h: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function circle(x: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  function poly(color: string, ...points: number[]): void {
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath(); ctx.fill();
  }
  function gearShape(x: number, y: number, r: number, teeth: number, angle: number, color: string, hole: string): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    for (let i = 0; i < teeth; i++) { ctx.rotate(TAU / teeth); rect(-r * 0.18, -r * 1.22, r * 0.36, r * 0.4, color); }
    ctx.restore();
    circle(x, y, r, color); circle(x, y, r * 0.35, hole);
  }

  function drawBackground(era: Era, state: GameState): void {
    const { cameraX, elapsed } = state;
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, era.sky);
    gradient.addColorStop(1, era.skyBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    switch (era.id) {
      case 'stone':
        ctx.fillStyle = '#f9e6a6'; ctx.beginPath(); ctx.arc(785, 100, 43, 0, TAU); ctx.fill();
        for (let i = 0; i < 10; i++) {
          const x = wrap(i * 157 - cameraX * 0.18, 120, 60);
          const h = 90 + (i % 4) * 22;
          rect(x, FLOOR - h - 30, 14, h + 40, i % 2 ? '#446e58' : '#568465');
          ctx.fillStyle = '#628e66'; ctx.beginPath(); ctx.arc(x + 6, FLOOR - h - 20, 33, 0, TAU); ctx.fill();
          rect(x + 3, FLOOR - h + 14, 5, 11, '#e98259');
        }
        break;
      case 'egypt':
        circle(780, 105, 52, '#fff1c1');
        for (let i = 0; i < 6; i++) {
          const x = wrap(i * 230 - cameraX * 0.16, 260, 130);
          const h = 120 + (i % 3) * 40;
          poly(i % 2 ? '#d9a85f' : '#cf9d55', x, FLOOR, x + h * 1.1, FLOOR - h, x + h * 2.2, FLOOR);
          poly('#b9864a', x + h * 1.1, FLOOR - h, x + h * 2.2, FLOOR, x + h * 1.3, FLOOR);
        }
        for (let i = 0; i < 5; i++) {
          const x = wrap(i * 260 - cameraX * 0.32, 200, 80);
          rect(x, FLOOR - 120, 10, 120, '#8c6a3a');
          for (let j = 0; j < 5; j++) poly('#4f8a4a', x + 5, FLOOR - 124, x + 5 + Math.cos(j * 1.3) * 46, FLOOR - 112 + Math.sin(j * 1.3) * 18, x + 5 + Math.cos(j * 1.3) * 30, FLOOR - 104 + Math.sin(j * 1.3) * 10);
        }
        break;
      case 'viking':
        circle(760, 95, 36, '#fdfdf2');
        for (let i = 0; i < 7; i++) {
          const x = wrap(i * 210 - cameraX * 0.12, 300, 150);
          const h = 170 + (i % 3) * 45;
          poly('#7f97ab', x, FLOOR, x + 150, FLOOR - h, x + 300, FLOOR);
          poly('#f4f9fc', x + 150, FLOOR - h, x + 110, FLOOR - h + 52, x + 150, FLOOR - h + 38, x + 190, FLOOR - h + 52);
        }
        for (let i = 0; i < 12; i++) {
          const x = wrap(i * 97 - cameraX * 0.3, 80, 40);
          const h = 60 + (i % 4) * 18;
          poly('#3f5d55', x, FLOOR, x + 22, FLOOR - h, x + 44, FLOOR);
        }
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 45; i++) {
          const x = ((i * 97 + elapsed * 18 * (1 + (i % 3)) - cameraX * 0.5) % W + W) % W;
          const y = (i * 53 + elapsed * 45 * (1 + (i % 2))) % FLOOR;
          ctx.fillRect(x, y, 3, 3);
        }
        break;
      case 'medieval':
        ctx.fillStyle = '#f3e0b0'; ctx.beginPath(); ctx.arc(775, 105, 40, 0, TAU); ctx.fill();
        for (let i = 0; i < 7; i++) {
          const x = wrap(i * 185 - cameraX * 0.22, 160, 90);
          rect(x, 180 + (i % 2) * 30, 112, FLOOR - 180, '#6d7d81');
          rect(x + 12, 158 + (i % 2) * 30, 87, 29, '#829297');
          for (let j = 0; j < 3; j++) { rect(x + 15 + j * 31, 214 + (i % 2) * 30, 14, 26, '#485b64'); rect(x + 18 + j * 31, 210 + (i % 2) * 30, 8, 7, '#c4a863'); }
        }
        break;
      case 'pirate':
        circle(800, 190, 60, '#ffcf7a');
        rect(0, FLOOR - 120, W, 120, '#2e86b5');
        for (let i = 0; i < 4; i++) {
          const x = wrap(i * 330 - cameraX * 0.15, 300, 120);
          poly('#5a3d28', x, FLOOR - 130, x + 110, FLOOR - 130, x + 92, FLOOR - 108, x + 18, FLOOR - 108);
          rect(x + 52, FLOOR - 220, 5, 92, '#4a3220');
          poly('#f3ead2', x + 58, FLOOR - 214, x + 100, FLOOR - 160, x + 58, FLOOR - 150);
          poly('#e8dcc0', x + 50, FLOOR - 206, x + 16, FLOOR - 156, x + 50, FLOOR - 150);
        }
        for (let i = 0; i < 18; i++) {
          const x = wrap(i * 60 - cameraX * 0.4 + Math.sin(elapsed * 2 + i) * 6, 60, 30);
          rect(x, FLOOR - 100 + (i % 4) * 22, 26, 3, '#7cc3e6');
        }
        break;
      case 'west':
        circle(770, 120, 58, '#ffe7a3');
        for (let i = 0; i < 6; i++) {
          const x = wrap(i * 240 - cameraX * 0.16, 280, 140);
          const h = 110 + (i % 3) * 35;
          poly(i % 2 ? '#c46a3c' : '#b85f35', x, FLOOR, x + 40, FLOOR - h, x + 190, FLOOR - h, x + 230, FLOOR);
          rect(x + 40, FLOOR - h, 150, 8, '#d98552');
        }
        for (let i = 0; i < 6; i++) {
          const x = wrap(i * 210 - cameraX * 0.34, 120, 60);
          rect(x, FLOOR - 70, 12, 70, '#4f7a3d'); rect(x - 14, FLOOR - 50, 14, 8, '#4f7a3d'); rect(x - 14, FLOOR - 64, 8, 18, '#4f7a3d'); rect(x + 12, FLOOR - 42, 12, 8, '#4f7a3d'); rect(x + 18, FLOOR - 56, 8, 18, '#4f7a3d');
        }
        break;
      case 'haunted': {
        circle(770, 100, 46, '#f2efd6'); circle(752, 88, 8, '#d9d4b4'); circle(785, 112, 6, '#d9d4b4');
        for (let i = 0; i < 5; i++) {
          const x = wrap(i * 260 - cameraX * 0.18, 260, 130);
          rect(x, FLOOR - 200, 160, 200, '#1a1528');
          poly('#1a1528', x - 10, FLOOR - 200, x + 80, FLOOR - 270, x + 170, FLOOR - 200);
          rect(x + 120, FLOOR - 250, 16, 40, '#1a1528');
          for (let j = 0; j < 6; j++) {
            const lit = Math.sin(elapsed * 1.7 + i * 3 + j) > 0.2;
            rect(x + 18 + (j % 3) * 46, FLOOR - 170 + Math.floor(j / 3) * 60, 22, 30, lit ? '#f7d774' : '#2b2340');
          }
        }
        for (let i = 0; i < 8; i++) {
          const x = wrap(i * 150 - cameraX * 0.36, 80, 40);
          rect(x, FLOOR - 40, 28, 40, '#4a4458'); circle(x + 14, FLOOR - 40, 14, '#4a4458'); rect(x + 12, FLOOR - 36, 4, 16, '#2e2a35'); rect(x + 7, FLOOR - 30, 14, 4, '#2e2a35');
        }
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 3; i++) rect(wrap(-cameraX * 0.5 + i * 400 + elapsed * 20, 400, 200), FLOOR - 60 - i * 26, 520, 22, '#d9d0ef');
        ctx.globalAlpha = 1;
        break;
      }
      case 'steam':
        for (let i = 0; i < 4; i++) {
          const x = wrap(i * 300 - cameraX * 0.12, 260, 130);
          gearShape(x + 100, 170 + (i % 2) * 40, 60, 10, elapsed * 0.3 * (i % 2 ? 1 : -1), '#7d7563', '#8d8775');
        }
        for (let i = 0; i < 6; i++) {
          const x = wrap(i * 220 - cameraX * 0.26, 200, 100);
          const h = 120 + (i % 3) * 40;
          rect(x, FLOOR - h, 130, h, '#5a4a3c');
          rect(x + 90, FLOOR - h - 80, 22, 80, '#4a3b2f');
          for (let j = 0; j < 3; j++) {
            const rise = (elapsed * 30 + j * 40 + i * 17) % 120;
            ctx.globalAlpha = Math.max(0, 0.5 - rise / 240); circle(x + 101 + Math.sin(rise / 20) * 8, FLOOR - h - 90 - rise, 14 + rise / 8, '#e9e2d0');
          }
          ctx.globalAlpha = 1;
          for (let j = 0; j < 4; j++) rect(x + 14 + j * 28, FLOOR - h + 24, 14, 18, '#f0b35a');
        }
        break;
      case 'future':
        ctx.fillStyle = '#e2ffff';
        for (let i = 0; i < 65; i++) {
          const x = ((i * 193 - cameraX * 0.12) % W + W) % W;
          const y = (i * 79) % 290;
          ctx.globalAlpha = 0.25 + (i % 5) * 0.12; ctx.fillRect(x, y, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 11; i++) {
          const x = wrap(i * 111 - cameraX * 0.28, 90, 40);
          const h = 95 + (i * 37) % 160;
          rect(x, FLOOR - h, 48, h, i % 2 ? '#1b3455' : '#1a2d4b');
          for (let yy = FLOOR - h + 13; yy < FLOOR - 12; yy += 21) for (let xx = x + 9; xx < x + 42; xx += 15) rect(xx, yy, 5, 8, (xx + yy) % 3 ? '#4cdbc8' : '#e777a8');
        }
        break;
      case 'end':
        ctx.fillStyle = '#fff6d8';
        for (let i = 0; i < 50; i++) {
          ctx.globalAlpha = 0.3 + 0.3 * Math.sin(elapsed * 3 + i);
          ctx.fillRect(((i * 211 - cameraX * 0.1) % W + W) % W, (i * 67) % 330, 2, 2);
        }
        ctx.globalAlpha = 1;
        for (let i = 0; i < 6; i++) {
          const x = wrap(i * 200 - cameraX * 0.2, 200, 100);
          const y = 140 + (i % 3) * 70 + Math.sin(elapsed + i) * 10;
          const r = 30 + (i % 3) * 12;
          circle(x, y, r, '#3d2457'); circle(x, y, r - 5, '#f6e7c1');
          ctx.strokeStyle = '#3d2457'; ctx.lineWidth = 3; ctx.beginPath();
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(elapsed * (2 + i)) * (r - 10), y + Math.sin(elapsed * (2 + i)) * (r - 10));
          ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(elapsed * 0.4 + i) * (r - 18), y + Math.sin(elapsed * 0.4 + i) * (r - 18));
          ctx.stroke();
        }
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 4; i++) {
          const y = (i * 131 + Math.floor(elapsed * 7) * 37) % FLOOR;
          rect(0, y, W, 3 + (i % 2) * 4, i % 2 ? '#ff5fa2' : '#5ff5ff');
        }
        ctx.globalAlpha = 1;
        break;
    }
  }

  function drawGround(platform: Platform, era: Era, x: number, cameraX: number): void {
    const future = era.id === 'future';
    rect(x, platform.y, platform.w, platform.h, era.ground);
    rect(x, platform.y, platform.w, 9, era.top);
    for (let tx = Math.floor(platform.x / 48) * 48; tx < platform.x + platform.w; tx += 48) {
      const sx = tx - cameraX;
      if (sx > -40 && sx < W + 10 && tx >= platform.x) { rect(sx, platform.y + 24 + (tx % 3) * 8, 20, 3, future ? '#365676' : '#ffffff19'); if (!future) rect(sx + 26, platform.y + 48, 8, 4, '#1a1d1a55'); }
    }
    if (future) rect(x, platform.y + 9, platform.w, 2, '#43f6dc');
  }

  function drawLedge(platform: Platform, era: Era, x: number, elapsed: number): void {
    const shake = platform.crumbleTime > 0 && !platform.fallen ? Math.sin(elapsed * 60) * 2 : 0;
    x += shake;
    rect(x, platform.y, platform.w, platform.h, era.top);
    rect(x, platform.y + platform.h, platform.w, 7, era.ground);
    if (era.id === 'stone') for (let bx = x + 8; bx < x + platform.w - 8; bx += 25) { rect(bx, platform.y + 5, 10, 4, '#705d42'); }
    else if (era.id === 'medieval') for (let bx = x + 6; bx < x + platform.w - 6; bx += 34) { rect(bx, platform.y + 3, 2, 13, '#d4cbc0'); }
    else if (era.id === 'future') { rect(x, platform.y - 2, platform.w, 2, '#b3fff5'); rect(x + 12, platform.y + 5, platform.w - 24, 2, '#65d8dc'); }
    else rect(x, platform.y, platform.w, 3, '#ffffff33');
    if (platform.crumble) {
      ctx.strokeStyle = '#00000088'; ctx.lineWidth = 2; ctx.beginPath();
      for (let cx = x + 18; cx < x + platform.w - 10; cx += 32) { ctx.moveTo(cx, platform.y); ctx.lineTo(cx + 6, platform.y + 8); ctx.lineTo(cx - 2, platform.y + 18); }
      ctx.stroke();
    }
  }

  function drawPlatforms(state: GameState, era: Era): void {
    const { cameraX } = state;
    // Pits: whatever lies between ground segments.
    let edge = 0;
    for (const platform of state.platforms) {
      if (platform.kind !== 'ground') continue;
      if (platform.x > edge) {
        rect(edge - cameraX, FLOOR, platform.x - edge, H - FLOOR, era.pit);
        if (era.id === 'pirate') for (let wx = edge; wx < platform.x - 10; wx += 22) rect(wx - cameraX + 4, FLOOR + 14 + Math.sin(state.elapsed * 3 + wx) * 3, 12, 2, '#7cc3e6');
      }
      edge = platform.x + platform.w;
    }
    for (const platform of state.platforms) {
      const x = platform.x - cameraX;
      if (x + platform.w < 0 || x > W || platform.y > H) continue;
      if (platform.kind === 'ground') drawGround(platform, era, x, cameraX);
      else drawLedge(platform, era, x, state.elapsed);
    }
  }

  function drawHazard(hazard: Hazard, state: GameState): void {
    const { cameraX, elapsed, player } = state;
    let x = hazard.x - cameraX;
    const { y, w, h } = hazard;
    const flap = Math.sin(elapsed * 16) * 5;
    switch (hazard.skin) {
      case 'boulder':
        ctx.fillStyle = '#78664d'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill();
        rect(x + 10, y + 7, 9, 5, '#a58a64'); rect(x + 20, y + 23, 10, 5, '#554a39');
        break;
      case 'snowball':
        circle(x + w / 2, y + h / 2, w / 2, '#f4f9ff'); circle(x + w / 2 + 4, y + h / 2 + 4, w / 2 - 6, '#d6e6f3');
        circle(x + w / 2 + Math.cos(hazard.x / 9) * 9, y + h / 2 + Math.sin(hazard.x / 9) * 9, 4, '#b8cfe2');
        break;
      case 'barrel':
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(hazard.x / 17);
        rect(-w / 2, -h / 2, w, h, '#8b5a2b'); rect(-w / 2, -h / 2 + 6, w, 4, '#3d3d3d'); rect(-w / 2, h / 2 - 10, w, 4, '#3d3d3d'); rect(-2, -h / 2, 4, h, '#6d4520');
        ctx.restore();
        break;
      case 'tumbleweed':
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(hazard.x / 15);
        ctx.strokeStyle = '#a7834d'; ctx.lineWidth = 2; ctx.beginPath();
        for (let i = 0; i < 9; i++) { ctx.moveTo(Math.cos(i) * 17, Math.sin(i) * 17); ctx.quadraticCurveTo(Math.cos(i * 2.3) * 4, Math.sin(i * 1.7) * 4, Math.cos(i + 2.6) * 17, Math.sin(i + 2.6) * 17); }
        ctx.stroke(); ctx.restore();
        break;
      case 'gear':
        gearShape(x + w / 2, y + h / 2, w / 2 - 6, 8, hazard.x / 14, '#b5793d', '#4a3b2f');
        break;
      case 'spikes':
        ctx.fillStyle = '#dce1dd'; ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x + 8, y + 5); ctx.lineTo(x + 16, y + h); ctx.lineTo(x + 24, y + 2); ctx.lineTo(x + 32, y + h); ctx.lineTo(x + 40, y + 6); ctx.lineTo(x + 48, y + h); ctx.closePath(); ctx.fill();
        rect(x, y + h - 5, w, 5, '#9c5554');
        break;
      case 'goldspikes':
        poly('#f2c14e', x, y + h, x + 8, y + 3, x + 16, y + h, x + 24, y, x + 32, y + h, x + 40, y + 4, x + 48, y + h);
        rect(x, y + h - 5, w, 5, '#6b3f1d');
        break;
      case 'cactus':
        rect(x + 10, y, 12, h, '#4c8a3f'); rect(x, y + 14, 10, 7, '#4c8a3f'); rect(x, y + 6, 6, 14, '#4c8a3f'); rect(x + 22, y + 20, 8, 7, '#4c8a3f'); rect(x + 24, y + 10, 6, 14, '#4c8a3f');
        for (let sy = y + 4; sy < y + h - 4; sy += 8) { rect(x + 8, sy, 2, 2, '#e8f0c0'); rect(x + 22, sy + 4, 2, 2, '#e8f0c0'); }
        break;
      case 'bat':
        ctx.fillStyle = '#303640'; ctx.beginPath(); ctx.moveTo(x + 21, y + 12); ctx.lineTo(x + 2, y + 1 + flap); ctx.lineTo(x + 8, y + 19); ctx.lineTo(x + 1, y + 24); ctx.lineTo(x + 18, y + 22); ctx.lineTo(x + 24, y + 28); ctx.lineTo(x + 27, y + 21); ctx.lineTo(x + 41, y + 24); ctx.lineTo(x + 34, y + 17); ctx.lineTo(x + 40, y + 2 + flap); ctx.lineTo(x + 23, y + 12); ctx.fill();
        rect(x + 25, y + 12, 3, 3, '#f4c650');
        break;
      case 'scarab':
        ctx.fillStyle = '#1f6f6b'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 2, 11, 9, 0, 0, TAU); ctx.fill();
        poly('#8fe3d4', x + w / 2, y + h / 2, x + 2, y + flap, x + 6, y + h / 2 + 4);
        poly('#8fe3d4', x + w / 2, y + h / 2, x + w - 2, y + flap, x + w - 6, y + h / 2 + 4);
        rect(x + w / 2 - 1, y + 4, 2, h - 6, '#0e3a38'); rect(x + w / 2 - 6, y + h / 2 - 2, 3, 3, '#ff5a3c');
        break;
      case 'raven':
        ctx.fillStyle = '#1b1d24'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 4, 14, 8, 0, 0, TAU); ctx.fill();
        poly('#1b1d24', x + 14, y + h / 2, x + 2, y + 2 + flap, x + 26, y + h / 2 + 2);
        poly('#1b1d24', x + 22, y + h / 2, x + 36, y + 2 + flap, x + 30, y + h / 2 + 4);
        poly('#f2b84b', x + 6, y + h / 2 + 2, x - 4, y + h / 2 + 5, x + 6, y + h / 2 + 7); rect(x + 9, y + h / 2, 3, 3, '#ff4747');
        break;
      case 'seagull':
        ctx.fillStyle = '#f7f7f2'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2 + 4, 12, 6, 0, 0, TAU); ctx.fill();
        poly('#a9b4bd', x + w / 2, y + h / 2 + 2, x + 2, y + flap, x + 12, y + h / 2 + 4);
        poly('#a9b4bd', x + w / 2, y + h / 2 + 2, x + w - 2, y + flap, x + w - 12, y + h / 2 + 4);
        poly('#f2b84b', x + 8, y + h / 2 + 3, x, y + h / 2 + 6, x + 8, y + h / 2 + 7);
        break;
      case 'ghost': {
        ctx.globalAlpha = 0.88; ctx.fillStyle = '#f4f0ff'; ctx.beginPath();
        ctx.arc(x + w / 2, y + 16, 16, Math.PI, 0); ctx.lineTo(x + w - 2, y + h);
        for (let i = 3; i >= 0; i--) ctx.lineTo(x + 2 + i * ((w - 4) / 4) + (i % 2 ? 4 : 0) + Math.sin(elapsed * 9 + i) * 2, y + h - (i % 2 ? 8 : 0));
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        circle(x + w / 2 - 6, y + 15, 4, '#2a1f3d'); circle(x + w / 2 + 6, y + 15, 4, '#2a1f3d');
        ctx.fillStyle = '#2a1f3d'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + 27, 4, 5 + Math.sin(elapsed * 6) * 1.5, 0, 0, TAU); ctx.fill();
        break;
      }
      case 'drone':
        ctx.fillStyle = '#48d9cb'; ctx.beginPath(); ctx.roundRect(x + 4, y + 5, 30, 20, 5); ctx.fill();
        rect(x + 10, y + 12, 18, 3, '#183b5a'); rect(x + 15, y + 12, 6, 3, '#ff6c98');
        ctx.strokeStyle = '#86f6e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 19, y + 4); ctx.lineTo(x + 19, y); ctx.stroke();
        ctx.fillStyle = '#ffca64'; ctx.beginPath(); ctx.arc(x + 19, y - 2, 2, 0, TAU); ctx.fill();
        break;
      case 'laser':
        rect(x + 5, y - 7, 7, 8, '#485c84');
        if (hazard.active) { ctx.globalAlpha = 0.27; rect(x + 5, y, 7, h, '#ff5b77'); ctx.globalAlpha = 1; rect(x + 7, y, 3, h, '#ff7890'); }
        rect(x + 3, y + h - 1, 11, 6, '#596a91');
        break;
      case 'flame':
        rect(x + 1, y + h - 8, 14, 10, '#55504f'); rect(x + 4, y + h - 12, 8, 4, '#3a3534');
        if (hazard.active) {
          for (let i = 0; i < 3; i++) {
            const wob = Math.sin(elapsed * 25 + i * 2) * 3;
            poly(i === 0 ? '#ff7a2f' : i === 1 ? '#ffb53c' : '#fff2a0', x + 2 + i * 2 + wob, y + h - 12, x + w / 2 + wob, y + i * 16, x + w - 2 - i * 2 + wob, y + h - 12);
          }
        } else if (Math.sin(elapsed * 30) > 0) rect(x + 6, y + h - 16, 4, 4, '#ff7a2f');
        break;
      case 'steam':
        rect(x, y + h - 10, w, 12, '#7d6a52'); rect(x + 4, y + h - 14, w - 8, 4, '#b5793d');
        if (hazard.active) {
          ctx.globalAlpha = 0.85;
          for (let i = 0; i < 6; i++) circle(x + w / 2 + Math.sin(elapsed * 12 + i * 1.7) * 5, y + h - 18 - i * 14, 9 + i, '#f2eee6');
          ctx.globalAlpha = 1;
        }
        break;
      case 'icicle':
      case 'chandelier':
      case 'anvil': {
        // Droppers wobble as a warning when the player gets close.
        const near = hazard.mode === 'wait' && player.x + player.w > hazard.x - DROPPER_WARN && player.x < hazard.x + hazard.w;
        if (near) x += Math.sin(elapsed * 45) * 2;
        if (hazard.mode === 'wait') { ctx.strokeStyle = '#00000055'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + w / 2, 0); ctx.lineTo(x + w / 2, y); ctx.stroke(); }
        if (hazard.skin === 'icicle') { poly('#bdf1ff', x, y, x + w, y, x + w / 2, y + h); poly('#ffffff', x + 3, y, x + 7, y, x + w / 2, y + h - 6); }
        else if (hazard.skin === 'chandelier') {
          rect(x + w / 2 - 1, y, 2, 10, '#c9a24a'); rect(x, y + 12, w, 5, '#c9a24a'); rect(x + 4, y + 17, w - 8, 4, '#a07f33');
          for (let i = 0; i < 3; i++) { rect(x + 4 + i * 16, y + 4, 5, 9, '#f6f0dc'); circle(x + 6.5 + i * 16, y + 2 + Math.sin(elapsed * 20 + i), 3, '#ffb53c'); }
          poly('#c9a24a', x + 10, y + 21, x + w - 10, y + 21, x + w / 2, y + h);
        } else { rect(x + 4, y, w - 8, 9, '#3b3f46'); rect(x + 10, y + 9, w - 20, 9, '#3b3f46'); rect(x, y + 18, w, 8, '#4d525b'); poly('#3b3f46', x + w - 4, y, x + w + 8, y + 3, x + w - 4, y + 9); }
        break;
      }
      case 'arrow':
        rect(x + 6, y + 3, w - 10, 2, '#7a5230'); poly('#c9c9c9', x, y + 4, x + 8, y, x + 8, y + 8);
        poly('#e35d4f', x + w - 6, y + 4, x + w + 2, y - 1, x + w, y + 4); poly('#e35d4f', x + w - 6, y + 4, x + w + 2, y + 9, x + w, y + 4);
        break;
      case 'cannonball':
        ctx.globalAlpha = 0.35; for (let i = 1; i < 4; i++) circle(x + w / 2 + i * 12, y + h / 2, 6 - i, '#d8d8d8'); ctx.globalAlpha = 1;
        circle(x + w / 2, y + h / 2, w / 2, '#22252a'); circle(x + w / 2 - 4, y + h / 2 - 4, 3, '#6b7280');
        break;
      case 'minecart':
        rect(x + 2, y + 4, w - 4, h - 12, '#6b6f75'); rect(x, y + 2, w, 5, '#4a4d52');
        circle(x + 10, y + h - 6, 6, '#2b2d31'); circle(x + w - 10, y + h - 6, 6, '#2b2d31');
        circle(x + 14, y + 2, 6, '#8a6a4a'); circle(x + 26, y, 7, '#9c7a55'); circle(x + 36, y + 3, 5, '#8a6a4a');
        break;
      case 'plasma':
        ctx.globalAlpha = 0.4; ctx.fillStyle = '#ff5fd2'; ctx.beginPath(); ctx.ellipse(x + w / 2 + 8, y + h / 2, w / 2 + 8, h / 2 + 3, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffd0f3'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, TAU); ctx.fill();
        break;
    }
  }

  function drawHazards(state: GameState): void {
    for (const hazard of state.hazards) {
      const x = hazard.x - state.cameraX;
      if (x + hazard.w < -20 || x > W + 20) continue;
      drawHazard(hazard, state);
    }
  }

  function drawPickups(state: GameState, era: Era): void {
    const { cameraX, elapsed } = state;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const x = pickup.x - cameraX;
      if (x < -30 || x > W + 30) continue;
      const y = pickup.y + Math.sin(elapsed * 4 + pickup.phase) * 5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(elapsed * 3 + pickup.phase) * 0.12);
      switch (era.collectible) {
        case 'berry':
          ctx.fillStyle = '#ed7661'; ctx.beginPath(); ctx.arc(-4, 1, 7, 0, TAU); ctx.arc(4, 1, 7, 0, TAU); ctx.fill();
          rect(-2, -11, 5, 4, '#567e4b'); rect(1, -8, 6, 3, '#7da858');
          break;
        case 'coin':
          ctx.fillStyle = '#ffc84e'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 12, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff0a5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, TAU); ctx.stroke();
          break;
        case 'core':
          ctx.fillStyle = '#53f3da'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, -2); ctx.lineTo(6, 11); ctx.lineTo(-6, 11); ctx.lineTo(-9, -2); ctx.closePath(); ctx.fill();
          rect(-2, -5, 4, 9, '#d8fff0');
          break;
        case 'gem':
          poly('#7fe3ff', 0, -12, 10, -2, 0, 12, -10, -2); poly('#dff8ff', 0, -12, 4, -2, 0, 4, -4, -2);
          break;
        case 'star': {
          const pts: number[] = [];
          for (let i = 0; i < 10; i++) { const r = i % 2 ? 5 : 12; pts.push(Math.cos(-Math.PI / 2 + i * Math.PI / 5) * r, Math.sin(-Math.PI / 2 + i * Math.PI / 5) * r); }
          poly('#ffd447', ...pts); circle(0, 0, 3, '#c98f1f');
          break;
        }
        case 'candy':
          poly('#ff8fc7', -8, 0, -15, -7, -15, 7); poly('#ff8fc7', 8, 0, 15, -7, 15, 7);
          circle(0, 0, 8, '#ff5fa2'); rect(-2, -8, 4, 16, '#ffd1e8');
          break;
        case 'cog':
          gearShape(0, 0, 8, 8, elapsed * 2, '#ffb347', '#6b4a2a');
          break;
      }
      ctx.restore();
    }
  }

  /** `time` is wall-clock seconds, so the victory dance keeps going while the game itself is paused. */
  function drawPlayer(state: GameState, time: number): void {
    const { player } = state;
    if (player.invulnerable > 0 && Math.floor(state.elapsed * 14) % 2 === 0) return;
    // Victory dance on the era-clear and final screens: hop, turn, and wave.
    const dancing = (state.phase === 'clear' || state.phase === 'victory') && !options.reducedMotion?.();
    const facing = dancing ? (Math.floor(time / 0.3) % 2 ? -1 : 1) : player.facing;
    const x = Math.round(player.x - state.cameraX);
    const y = Math.round(player.y - (dancing ? Math.abs(Math.sin(time * 7)) * 12 : 0));
    const armsUp = dancing && Math.floor(time / 0.15) % 2 === 0;
    ctx.save();
    if (facing < 0) { ctx.translate(x + player.w, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);
    drawHero(ctx, y, { outfit: options.outfit?.() ?? 'classic', armsUp });
    ctx.restore();
  }

  function drawFlag(worldX: number, color: string, height: number): void {
    const x = worldX - 90;
    rect(x + 29, FLOOR - 94, 5, 94, '#d9e7c9');
    poly(color, x + 34, FLOOR - 92 + (94 - height), x + 82, FLOOR - 77 + (94 - height), x + 34, FLOOR - 60 + (94 - height));
    rect(x + 19, FLOOR - 5, 25, 5, '#1b2826');
  }

  /** Small icon for a power-up kind, centred on (x, y). */
  function powerIcon(kind: PowerKind, x: number, y: number, size: number): void {
    const u = size / 10;
    ctx.save(); ctx.translate(x, y);
    if (kind === 'shield') {
      poly('#1b4f72', 0, -4 * u, 3.5 * u, -2.5 * u, 3 * u, 1.5 * u, 0, 4 * u, -3 * u, 1.5 * u, -3.5 * u, -2.5 * u);
      rect(-0.5 * u, -2.5 * u, u, 5 * u, '#6fd3ff');
    } else if (kind === 'freeze') {
      ctx.strokeStyle = '#1b4f72'; ctx.lineWidth = Math.max(2, u * 0.9); ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = (i * Math.PI) / 3; ctx.moveTo(Math.cos(a) * -4 * u, Math.sin(a) * -4 * u); ctx.lineTo(Math.cos(a) * 4 * u, Math.sin(a) * 4 * u); }
      ctx.stroke();
    } else if (kind === 'magnet') {
      ctx.strokeStyle = '#7a1d2a'; ctx.lineWidth = 2.2 * u; ctx.beginPath(); ctx.arc(0, -0.5 * u, 2.6 * u, Math.PI, 0); ctx.stroke();
      rect(-3.7 * u, -0.5 * u, 2.2 * u, 3.5 * u, '#7a1d2a'); rect(1.5 * u, -0.5 * u, 2.2 * u, 3.5 * u, '#7a1d2a');
      rect(-3.7 * u, 2 * u, 2.2 * u, 1.2 * u, '#f4f4f4'); rect(1.5 * u, 2 * u, 2.2 * u, 1.2 * u, '#f4f4f4');
    } else {
      poly('#7a5a00', -3 * u, 3.5 * u, 0, -0.5 * u, 3 * u, 3.5 * u); poly('#7a5a00', -3 * u, 0, 0, -4 * u, 3 * u, 0);
    }
    ctx.restore();
  }

  function drawPowerUps(state: GameState): void {
    for (const powerup of state.powerups) {
      if (powerup.taken) continue;
      const x = powerup.x - state.cameraX;
      if (x < -40 || x > W + 40) continue;
      const y = powerup.y + Math.sin(state.elapsed * 3 + powerup.x) * 4;
      const half = POWER_UP_SIZE / 2;
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(state.elapsed * 6);
      circle(x, y, half + 8, POWER_COLORS[powerup.kind]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect(x - half, y - half, POWER_UP_SIZE, POWER_UP_SIZE, 6); ctx.fill();
      ctx.strokeStyle = POWER_COLORS[powerup.kind]; ctx.lineWidth = 3; ctx.stroke();
      powerIcon(powerup.kind, x, y, POWER_UP_SIZE * 0.8);
    }
  }

  /** Icy tint over hazards while time is frozen. */
  function drawFreezeTint(state: GameState): void {
    if (state.effects.freeze <= 0) return;
    ctx.globalAlpha = 0.45;
    for (const hazard of state.hazards) {
      const x = hazard.x - state.cameraX;
      if (x + hazard.w < -20 || x > W + 20) continue;
      ctx.fillStyle = '#c9f4ff'; ctx.beginPath(); ctx.roundRect(x - 3, hazard.y - 3, hazard.w + 6, hazard.h + 6, 6); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawShieldBubble(state: GameState): void {
    if (!state.effects.shield) return;
    const { player } = state;
    const cx = player.x + player.w / 2 - state.cameraX;
    const cy = player.y + player.h / 2;
    ctx.globalAlpha = 0.25; circle(cx, cy, 34, '#6fd3ff');
    ctx.globalAlpha = 0.8; ctx.strokeStyle = '#bdefff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, 34 + Math.sin(state.elapsed * 8) * 1.5, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Active effects as icons with a draining bar, bottom-left of the play area. */
  function drawEffectBadges(state: GameState): void {
    const { effects } = state;
    const badges: [PowerKind, number][] = [];
    if (effects.shield) badges.push(['shield', 1]);
    if (effects.freeze > 0) badges.push(['freeze', effects.freeze / FREEZE_TIME]);
    if (effects.magnet > 0) badges.push(['magnet', effects.magnet / MAGNET_TIME]);
    if (effects.doubleJump > 0) badges.push(['doubleJump', effects.doubleJump / DOUBLE_JUMP_TIME]);
    badges.forEach(([kind, left], i) => {
      const x = 22 + i * 46;
      const y = H - 44;
      ctx.fillStyle = '#10201fd9'; ctx.beginPath(); ctx.roundRect(x - 4, y - 4, 40, 34, 6); ctx.fill();
      powerIcon(kind, x + 16, y + 11, 18);
      rect(x, y + 22, 32, 4, '#ffffff33');
      rect(x, y + 22, 32 * left, 4, POWER_COLORS[kind]);
    });
  }

  function drawFlags(state: GameState, era: Era): void {
    drawFlag(WORLD_END - state.cameraX, era.accent, 94);
    // Checkpoint flag sits low and grey until reached, then flies in the era colour.
    const reached = state.checkpointX >= CHECKPOINT_X;
    drawFlag(CHECKPOINT_X + 60 - state.cameraX, reached ? era.accent : '#8a9095', reached ? 94 : 40);
  }

  /**
   * Spooky atmosphere, drawn over the world but under the HUD: darkness with a soft glow around the hero,
   * drifting fog, and pairs of eyes that blink in the dark. Cartoon-creepy, nothing gory.
   */
  function drawSpooky(state: GameState, time: number): void {
    const { player, cameraX } = state;
    const px = player.x + player.w / 2 - cameraX;
    const py = player.y + player.h / 2;
    const reduced = options.reducedMotion?.() ?? false;
    // Brief flickers, like a failing light (not for reduced motion).
    const flicker = !reduced && Math.sin(time * 13) + Math.sin(time * 7.3) > 1.75 ? 0.15 : 0;
    const dark = ctx.createRadialGradient(px, py, 70, px, py, 320);
    dark.addColorStop(0, 'rgba(6, 4, 18, 0)');
    dark.addColorStop(0.55, `rgba(6, 4, 18, ${0.45 + flicker})`);
    dark.addColorStop(1, `rgba(6, 4, 18, ${0.82 + flicker})`);
    ctx.fillStyle = dark;
    ctx.fillRect(0, 0, W, H);

    // Low fog: soft clouds that drift along the ground.
    for (let i = 0; i < 6; i++) {
      const drift = reduced ? 0 : time * (10 + (i % 3) * 5);
      const fx = wrap(-cameraX * 0.6 + i * 190 + drift, 300, 150);
      const fy = FLOOR - 10 - (i % 2) * 26;
      const fog = ctx.createRadialGradient(fx, fy, 10, fx, fy, 150);
      fog.addColorStop(0, 'rgba(205, 214, 255, 0.2)');
      fog.addColorStop(1, 'rgba(205, 214, 255, 0)');
      ctx.fillStyle = fog;
      ctx.fillRect(fx - 150, fy - 150, 300, 300);
    }

    // Eyes in the dark; each pair blinks now and then.
    for (let i = 0; i < 7; i++) {
      if (Math.sin(time * 0.9 + i * 2.1) > 0.93) continue;
      const ex = wrap(i * 173 - cameraX * 0.35, 120, 60);
      const ey = 110 + (i % 4) * 55;
      const color = i % 3 === 0 ? '#ffd23f' : '#ff3b3b';
      ctx.globalAlpha = 0.35; circle(ex, ey, 9, color); circle(ex + 18, ey, 9, color);
      ctx.globalAlpha = 1; circle(ex, ey, 3, color); circle(ex + 18, ey, 3, color);
    }
  }

  return function draw(state: GameState, time = 0): void {
    const era = ERAS[state.eraIndex];
    const scare = state.scare;
    ctx.save();
    if (scare && !options.reducedMotion?.()) {
      const shake = 14 * Math.max(0, 1 - scare.t / 0.7);
      ctx.translate(Math.sin(scare.t * 97) * shake, Math.cos(scare.t * 83) * shake);
    }
    drawBackground(era, state);
    drawPlatforms(state, era);
    drawFlags(state, era);
    drawPickups(state, era);
    drawHazards(state);
    drawFreezeTint(state);
    drawPowerUps(state);
    for (const p of state.particles) { ctx.globalAlpha = Math.max(0, p.life / PARTICLE_LIFE); rect(p.x - state.cameraX, p.y, 4, 4, p.color); }
    ctx.globalAlpha = 1;
    drawPlayer(state, time);
    drawShieldBubble(state);
    if (options.spooky?.()) drawSpooky(state, time);
    for (const popup of state.popups) {
      ctx.globalAlpha = Math.min(1, popup.life / (POPUP_LIFE * 0.5));
      ctx.font = '900 26px "Trebuchet MS", "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 6; ctx.strokeStyle = '#13261d'; ctx.strokeText(popup.text, popup.x - state.cameraX, popup.y);
      ctx.fillStyle = '#7dff8a'; ctx.fillText(popup.text, popup.x - state.cameraX, popup.y);
    }
    ctx.globalAlpha = 1;
    if (state.phase === 'playing') drawEffectBadges(state);
    if (state.phase === 'playing') {
      const progress = Math.min(1, state.player.x / WORLD_END);
      rect(0, H - 4, W * progress, 4, era.accent);
    }
    ctx.restore();
  };
}

