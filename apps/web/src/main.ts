import './style.css';
import { createSound } from './game/audio';
import { ERAS, LAST_ERA, START_LIVES } from './game/config';
import { bindInput } from './game/input';
import { createRenderer } from './game/render';
import { advanceEra, beginGame, createGame, frameDelta, requestJump, step, type GameState } from './game/simulation';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

const canvas = byId<HTMLCanvasElement>('game');
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D is not supported');

const scoreEl = byId('score');
const heartsEl = byId('hearts');
const eraEl = byId('era');
const overlay = byId('overlay');
const titleEl = byId('title');
const eyebrowEl = byId('eyebrow');
const messageEl = byId('message');
const instructionsEl = byId('instructions');
const actionButton = byId<HTMLButtonElement>('action');
const restartButton = byId<HTMLButtonElement>('restart');
const soundButton = byId<HTMLButtonElement>('sound');

const state: GameState = createGame();
const sound = createSound();
const draw = createRenderer(ctx);
let actionHandler = start;

const pad = (score: number) => String(score).padStart(4, '0');

function setTitle(line: string, emphasis: string): void {
  const em = document.createElement('em');
  em.textContent = emphasis;
  titleEl.replaceChildren(line, document.createElement('br'), em);
}

function updateHud(): void {
  scoreEl.textContent = pad(state.score);
  heartsEl.textContent = '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, START_LIVES - state.lives));
  eraEl.textContent = ERAS[state.eraIndex].name;
}

function showOverlay(): void {
  overlay.classList.remove('hidden');
  restartButton.hidden = true;
  instructionsEl.hidden = state.phase !== 'start';
  if (state.phase === 'start') {
    eyebrowEl.textContent = 'A tiny hero. A very big timeline.';
    setTitle('Chronokid:', 'Era Hopper');
    messageEl.textContent = 'Dash through three strange ages, scoop up the shiny stuff, and keep your feet out of trouble.';
    actionButton.textContent = 'Play Game';
    actionHandler = start;
  } else if (state.phase === 'clear') {
    const last = state.eraIndex === LAST_ERA;
    eyebrowEl.textContent = `ERA ${state.eraIndex + 1} COMPLETE`;
    if (last) setTitle('Timeline', 'secured!'); else setTitle('Time to', 'hop.');
    messageEl.textContent = last
      ? 'You made it through the whole timeline. The future is looking pretty good.'
      : `Next stop: ${ERAS[state.eraIndex + 1].name.toLowerCase()}. The rules are about to change.`;
    actionButton.textContent = last ? 'See Final Score' : 'Advance to Next Era';
    actionHandler = advance;
  } else {
    const won = state.phase === 'victory';
    eyebrowEl.textContent = won ? 'ALL AGES, ONE LEGEND' : 'THAT TIMELINE GOT BUMPY';
    if (won) setTitle('Time well', 'hopped.'); else setTitle('Game', 'over.');
    messageEl.textContent = `${won ? 'Timeline complete' : 'The adventure ends here'} — final score: ${pad(state.score)}.`;
    actionButton.hidden = true;
    restartButton.hidden = false;
  }
}

function hideOverlay(): void {
  overlay.classList.add('hidden');
  actionButton.blur();
  restartButton.blur();
  actionButton.hidden = false;
  restartButton.hidden = true;
}

function start(): void {
  sound.start();
  beginGame(state);
  updateHud();
  hideOverlay();
}

function advance(): void {
  sound.play('advance');
  advanceEra(state);
  updateHud();
  if (state.phase === 'victory') showOverlay(); else hideOverlay();
}

actionButton.addEventListener('click', () => actionHandler());
restartButton.addEventListener('click', start);
soundButton.addEventListener('click', () => {
  const on = sound.toggle();
  soundButton.textContent = on ? '♫' : '×';
  soundButton.setAttribute('aria-label', on ? 'Turn sound off' : 'Turn sound on');
});

const keys = bindInput(document, {
  onJump: () => requestJump(state),
  onEnter: () => { if (state.phase === 'start') start(); }
});

let lastTime = 0;
function frame(timestamp: number): void {
  const dt = frameDelta(timestamp, lastTime);
  lastTime = timestamp;
  for (const event of step(state, keys, dt)) {
    if (event === 'jump' || event === 'collect' || event === 'hit') sound.play(event);
    if (event === 'collect' || event === 'hit') updateHud();
    if (event === 'clear' || event === 'gameover') showOverlay();
  }
  draw(state);
  requestAnimationFrame(frame);
}

// Development-only hook for browser tests; stripped from production builds.
if (import.meta.env.DEV) (window as Window & { __chronokid?: { state: GameState } }).__chronokid = { state };

updateHud();
showOverlay();
requestAnimationFrame(frame);
