// Confetti for perfect eras and the final victory. Decorative only: hidden from assistive tech,
// never blocks clicks, and skipped entirely for players who prefer reduced motion.
const COLORS = ['#c6f36b', '#ffd84d', '#ff8066', '#6fd3ff', '#c9a0ff', '#f6efd9'];
const PIECES = 60;
const LIFETIME_MS = 4000;

export function celebrate(reducedMotion: boolean): void {
  if (reducedMotion) return;
  document.querySelector('.confetti')?.remove();
  const layer = document.createElement('div');
  layer.className = 'confetti';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < PIECES; i++) {
    const piece = document.createElement('span');
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = COLORS[i % COLORS.length];
    piece.style.setProperty('--fall', `${2 + Math.random() * 1.6}s`);
    piece.style.setProperty('--delay', `${Math.random() * 0.6}s`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 160}px`);
    piece.style.setProperty('--spin', `${360 + Math.random() * 540}deg`);
    layer.append(piece);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), LIFETIME_MS);
}
