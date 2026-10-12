// Canvas drawing, ported from the original prototype without visual changes.
import { ERAS, FLOOR, H, W, WORLD_END, type Era } from './config';
import { PARTICLE_LIFE, type GameState } from './simulation';

export function createRenderer(ctx: CanvasRenderingContext2D): (state: GameState) => void {
  function rect(x: number, y: number, w: number, h: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function drawBackground(era: Era, eraIndex: number, cameraX: number): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, era.sky);
    gradient.addColorStop(1, eraIndex === 2 ? '#203151' : '#e0cba1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    if (eraIndex === 0) {
      ctx.fillStyle = '#f9e6a6'; ctx.beginPath(); ctx.arc(785, 100, 43, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 10; i++) {
        const x = ((i * 157 - cameraX * 0.18) % (W + 120) + W + 120) % (W + 120) - 60;
        const h = 90 + (i % 4) * 22;
        rect(x, FLOOR - h - 30, 14, h + 40, i % 2 ? '#446e58' : '#568465');
        ctx.fillStyle = '#628e66'; ctx.beginPath(); ctx.arc(x + 6, FLOOR - h - 20, 33, 0, Math.PI * 2); ctx.fill();
        rect(x + 3, FLOOR - h + 14, 5, 11, '#e98259');
      }
    } else if (eraIndex === 1) {
      ctx.fillStyle = '#f3e0b0'; ctx.beginPath(); ctx.arc(775, 105, 40, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const x = ((i * 185 - cameraX * 0.22) % (W + 160) + W + 160) % (W + 160) - 90;
        rect(x, 180 + (i % 2) * 30, 112, FLOOR - 180, '#6d7d81');
        rect(x + 12, 158 + (i % 2) * 30, 87, 29, '#829297');
        for (let j = 0; j < 3; j++) { rect(x + 15 + j * 31, 214 + (i % 2) * 30, 14, 26, '#485b64'); rect(x + 18 + j * 31, 210 + (i % 2) * 30, 8, 7, '#c4a863'); }
      }
    } else {
      ctx.fillStyle = '#e2ffff';
      for (let i = 0; i < 65; i++) {
        const x = ((i * 193 - cameraX * 0.12) % W + W) % W;
        const y = (i * 79) % 290;
        ctx.globalAlpha = 0.25 + (i % 5) * 0.12; ctx.fillRect(x, y, i % 7 === 0 ? 3 : 2, i % 7 === 0 ? 3 : 2);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < 11; i++) {
        const x = ((i * 111 - cameraX * 0.28) % (W + 90) + W + 90) % (W + 90) - 40;
        const h = 95 + (i * 37) % 160;
        rect(x, FLOOR - h, 48, h, i % 2 ? '#1b3455' : '#1a2d4b');
        for (let yy = FLOOR - h + 13; yy < FLOOR - 12; yy += 21) for (let xx = x + 9; xx < x + 42; xx += 15) rect(xx, yy, 5, 8, (xx + yy) % 3 ? '#4cdbc8' : '#e777a8');
      }
    }
  }

  function drawPlatforms(state: GameState, era: Era): void {
    const { cameraX, eraIndex } = state;
    for (const platform of state.platforms) {
      const x = platform.x - cameraX;
      if (x + platform.w < 0 || x > W) continue;
      if (platform.kind === 'ground') {
        rect(x, platform.y, platform.w, platform.h, era.ground);
        rect(x, platform.y, platform.w, 9, era.top);
        for (let tx = Math.floor(platform.x / 48) * 48; tx < platform.x + platform.w; tx += 48) {
          const sx = tx - cameraX;
          if (sx > -40 && sx < W + 10) { rect(sx, platform.y + 24 + (tx % 3) * 8, 20, 3, eraIndex === 2 ? '#365676' : '#ffffff19'); if (eraIndex !== 2) rect(sx + 26, platform.y + 48, 8, 4, '#1a1d1a55'); }
        }
        if (eraIndex === 2) rect(x, platform.y + 9, platform.w, 2, '#43f6dc');
      } else {
        rect(x, platform.y, platform.w, platform.h, era.top);
        rect(x, platform.y + platform.h, platform.w, 7, era.ground);
        if (eraIndex === 0) for (let bx = x + 8; bx < x + platform.w - 8; bx += 25) { rect(bx, platform.y + 5, 10, 4, '#705d42'); }
        if (eraIndex === 1) for (let bx = x + 6; bx < x + platform.w - 6; bx += 34) { rect(bx, platform.y + 3, 2, 13, '#d4cbc0'); }
        if (eraIndex === 2) { rect(x, platform.y - 2, platform.w, 2, '#b3fff5'); rect(x + 12, platform.y + 5, platform.w - 24, 2, '#65d8dc'); }
      }
    }
  }

  function drawHazards(state: GameState): void {
    const { cameraX, elapsed } = state;
    for (const hazard of state.hazards) {
      const x = hazard.x - cameraX;
      if (x + hazard.w < -20 || x > W + 20) continue;
      if (hazard.type === 'boulder') {
        ctx.fillStyle = '#78664d'; ctx.beginPath(); ctx.ellipse(x + hazard.w / 2, hazard.y + hazard.h / 2, hazard.w / 2, hazard.h / 2, 0, 0, Math.PI * 2); ctx.fill();
        rect(x + 10, hazard.y + 7, 9, 5, '#a58a64'); rect(x + 20, hazard.y + 23, 10, 5, '#554a39');
      } else if (hazard.type === 'spikes') {
        ctx.fillStyle = '#dce1dd'; ctx.beginPath(); ctx.moveTo(x, hazard.y + hazard.h); ctx.lineTo(x + 8, hazard.y + 5); ctx.lineTo(x + 16, hazard.y + hazard.h); ctx.lineTo(x + 24, hazard.y + 2); ctx.lineTo(x + 32, hazard.y + hazard.h); ctx.lineTo(x + 40, hazard.y + 6); ctx.lineTo(x + 48, hazard.y + hazard.h); ctx.closePath(); ctx.fill();
        rect(x, hazard.y + hazard.h - 5, hazard.w, 5, '#9c5554');
      } else if (hazard.type === 'bat') {
        ctx.fillStyle = '#303640'; ctx.beginPath(); ctx.moveTo(x + 21, hazard.y + 12); ctx.lineTo(x + 2, hazard.y + 1 + Math.sin(elapsed * 16) * 5); ctx.lineTo(x + 8, hazard.y + 19); ctx.lineTo(x + 1, hazard.y + 24); ctx.lineTo(x + 18, hazard.y + 22); ctx.lineTo(x + 24, hazard.y + 28); ctx.lineTo(x + 27, hazard.y + 21); ctx.lineTo(x + 41, hazard.y + 24); ctx.lineTo(x + 34, hazard.y + 17); ctx.lineTo(x + 40, hazard.y + 2 + Math.sin(elapsed * 16) * 5); ctx.lineTo(x + 23, hazard.y + 12); ctx.fill();
        rect(x + 25, hazard.y + 12, 3, 3, '#f4c650');
      } else if (hazard.type === 'laser') {
        rect(x + 5, hazard.y - 7, 7, 8, '#485c84');
        if (hazard.active) { ctx.globalAlpha = 0.27; rect(x + 5, hazard.y, 7, hazard.h, '#ff5b77'); ctx.globalAlpha = 1; rect(x + 7, hazard.y, 3, hazard.h, '#ff7890'); }
        rect(x + 3, hazard.y + hazard.h - 1, 11, 6, '#596a91');
      } else {
        ctx.fillStyle = '#48d9cb'; ctx.beginPath(); ctx.roundRect(x + 4, hazard.y + 5, 30, 20, 5); ctx.fill();
        rect(x + 10, hazard.y + 12, 18, 3, '#183b5a'); rect(x + 15, hazard.y + 12, 6, 3, '#ff6c98');
        ctx.strokeStyle = '#86f6e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 19, hazard.y + 4); ctx.lineTo(x + 19, hazard.y); ctx.stroke();
        ctx.fillStyle = '#ffca64'; ctx.beginPath(); ctx.arc(x + 19, hazard.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPickups(state: GameState, era: Era): void {
    const { cameraX, elapsed } = state;
    for (const pickup of state.pickups) {
      if (pickup.taken) continue;
      const x = pickup.x - cameraX;
      const y = pickup.y + Math.sin(elapsed * 4 + pickup.phase) * 5;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(elapsed * 3 + pickup.phase) * 0.12);
      if (era.collectible === 'berry') {
        ctx.fillStyle = '#ed7661'; ctx.beginPath(); ctx.arc(-4, 1, 7, 0, Math.PI * 2); ctx.arc(4, 1, 7, 0, Math.PI * 2); ctx.fill();
        rect(-2, -11, 5, 4, '#567e4b'); rect(1, -8, 6, 3, '#7da858');
      } else if (era.collectible === 'coin') {
        ctx.fillStyle = '#ffc84e'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff0a5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, 0, 4, 8, 0, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = '#53f3da'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, -2); ctx.lineTo(6, 11); ctx.lineTo(-6, 11); ctx.lineTo(-9, -2); ctx.closePath(); ctx.fill();
        rect(-2, -5, 4, 9, '#d8fff0');
      }
      ctx.restore();
    }
  }

  function drawPlayer(state: GameState): void {
    const { player } = state;
    if (player.invulnerable > 0 && Math.floor(state.elapsed * 14) % 2 === 0) return;
    const x = Math.round(player.x - state.cameraX); const y = Math.round(player.y);
    ctx.save();
    if (player.facing < 0) { ctx.translate(x + player.w, 0); ctx.scale(-1, 1); } else ctx.translate(x, 0);
    // Tiny time-traveler silhouette, intentionally built from crisp canvas blocks.
    rect(7, y + 1, 20, 17, '#f2c36b');
    rect(11, y + 5, 3, 3, '#172d36'); rect(22, y + 5, 3, 3, '#172d36');
    rect(9, y + 18, 19, 16, '#2e9a91');
    rect(3, y + 19, 8, 6, '#eaa959'); rect(27, y + 20, 7, 6, '#eaa959');
    rect(10, y + 33, 7, 10, '#e8b85e'); rect(21, y + 33, 7, 10, '#e8b85e');
    rect(8, y + 41, 10, 3, '#30404b'); rect(20, y + 41, 11, 3, '#30404b');
    rect(9, y - 2, 18, 4, '#415b64'); rect(13, y - 6, 11, 4, '#5fe2cb');
    ctx.restore();
  }

  function drawFinish(state: GameState): void {
    const x = WORLD_END - 90 - state.cameraX;
    rect(x + 29, FLOOR - 94, 5, 94, '#d9e7c9');
    ctx.fillStyle = ERAS[state.eraIndex].accent; ctx.beginPath(); ctx.moveTo(x + 34, FLOOR - 92); ctx.lineTo(x + 82, FLOOR - 77); ctx.lineTo(x + 34, FLOOR - 60); ctx.closePath(); ctx.fill();
    rect(x + 19, FLOOR - 5, 25, 5, '#1b2826');
  }

  return function draw(state: GameState): void {
    const era = ERAS[state.eraIndex];
    drawBackground(era, state.eraIndex, state.cameraX);
    drawPlatforms(state, era);
    drawFinish(state);
    drawPickups(state, era);
    drawHazards(state);
    for (const p of state.particles) { ctx.globalAlpha = Math.max(0, p.life / PARTICLE_LIFE); rect(p.x - state.cameraX, p.y, 4, 4, p.color); }
    ctx.globalAlpha = 1;
    drawPlayer(state);
    if (state.phase === 'playing') {
      const progress = Math.min(1, state.player.x / WORLD_END);
      rect(0, H - 4, W * progress, 4, era.accent);
    }
  };
}
