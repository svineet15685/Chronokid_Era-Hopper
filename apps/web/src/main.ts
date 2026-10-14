import type { RunOutcome } from '@chronokid/shared';
import './style.css';
import { createSound } from './game/audio';
import { CHECKPOINT_X, ERAS, LAST_ERA, START_LIVES } from './game/config';
import { bindInput } from './game/input';
import { createRenderer } from './game/render';
import { createScareLayer } from './game/scares';
import { STAR_PICKUPS, advanceEra, beginGame, createGame, frameDelta, requestJump, retryEra, step, type GameState } from './game/simulation';
import { OnlineSession } from './online/session';
import { ProgressTracker } from './progress';
import { celebrate } from './ui/celebrate';
import { renderFinishResult, renderJoinPrompt, renderLeaderboard, renderNote } from './ui/online-panel';

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

/** Per-browser preferences; storage can be unavailable (private mode), so failures fall back to defaults. */
const prefs = {
  get(key: string, fallback: boolean): boolean {
    try { const value = localStorage.getItem(`chronokid.${key}`); return value === null ? fallback : value === 'on'; } catch { return fallback; }
  },
  set(key: string, on: boolean): void {
    try { localStorage.setItem(`chronokid.${key}`, on ? 'on' : 'off'); } catch { /* not persisted */ }
  }
};

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
const scaresButton = byId<HTMLButtonElement>('scares');
const onlineEl = byId('online');
const leaderboardButton = byId<HTMLButtonElement>('leaderboard-open');
const boardOverlay = byId('board');
const boardList = byId('board-list');
const boardStatus = byId('board-status');
const boardJoin = byId('board-join');
const boardClose = byId<HTMLButtonElement>('board-close');
const starsEl = byId('stars');
const starRowEl = byId('star-row');
const starHintEl = byId('star-hint');
const erasButton = byId<HTMLButtonElement>('eras-open');
const mapOverlay = byId('map');
const eraGrid = byId('era-grid');
const mapClose = byId<HTMLButtonElement>('map-close');

const state: GameState = createGame();
const sound = createSound();
/** Respects the device setting live, so changing it takes effect without a reload. */
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const draw = createRenderer(ctx, { reducedMotion });
const drawScareLayer = createScareLayer(byId<HTMLCanvasElement>('scare-layer'), { reducedMotion });
const online = new OnlineSession();
const progress = new ProgressTracker();
/** Whether the era just cleared beat its previous best stars. */
let newBestStars = false;
let actionHandler = start;
/** Bumped whenever a menu changes, so slow network replies never write into a newer screen. */
let screen = 0;
let boardView = 0;

const pad = (score: number) => String(score).padStart(4, '0');

function setTitle(line: string, emphasis: string): void {
  const em = document.createElement('em');
  em.textContent = emphasis;
  titleEl.replaceChildren(line, document.createElement('br'), em);
}

function updateHud(): void {
  scoreEl.textContent = pad(state.score);
  heartsEl.textContent = '♥'.repeat(Math.max(0, state.lives)) + '♡'.repeat(Math.max(0, START_LIVES - state.lives));
  eraEl.textContent = `${state.eraIndex + 1}/${ERAS.length} ${ERAS[state.eraIndex].name}`;
}

/** Briefly enlarges the hearts so an extra life is noticeable. */
function pulseHearts(): void {
  heartsEl.classList.remove('pulse');
  void heartsEl.offsetWidth; // restart the animation if it is already running
  heartsEl.classList.add('pulse');
}

function showOverlay(): void {
  screen++;
  onlineEl.replaceChildren();
  leaderboardButton.hidden = state.phase === 'clear';
  erasButton.hidden = state.phase === 'clear';
  starsEl.hidden = state.phase !== 'clear';
  overlay.classList.remove('hidden');
  actionButton.hidden = false;
  restartButton.hidden = true;
  instructionsEl.hidden = state.phase !== 'start';
  if (state.phase === 'start') {
    eyebrowEl.textContent = 'A tiny hero. A very big timeline.';
    setTitle('Chronokid:', 'Era Hopper');
    messageEl.textContent = `Dash through ten strange ages, scoop up the shiny stuff, and keep your feet out of trouble. Watch out for surprises!`;
    actionButton.textContent = 'Play Game';
    actionHandler = start;
  } else if (state.phase === 'clear') {
    const last = state.eraIndex === LAST_ERA;
    eyebrowEl.textContent = `ERA ${state.eraIndex + 1} OF ${ERAS.length} COMPLETE`;
    if (last) setTitle('Timeline', 'secured!'); else setTitle('Time to', 'hop.');
    messageEl.textContent = last
      ? 'You made it through the whole timeline. The future is looking pretty good.'
      : `Next stop: ${ERAS[state.eraIndex + 1].name.toLowerCase()}. The rules are about to change.`;
    actionButton.textContent = last ? 'See Final Score' : 'Advance to Next Era';
    actionHandler = advance;
    renderStars();
  } else if (state.phase === 'victory') {
    eyebrowEl.textContent = 'ALL AGES, ONE LEGEND';
    setTitle('Time well', 'hopped.');
    messageEl.textContent = `Timeline complete — final score: ${pad(state.score)}.`;
    actionButton.hidden = true;
    restartButton.hidden = false;
    restartButton.textContent = 'Play Again';
  } else {
    const fromCheckpoint = state.checkpointX >= CHECKPOINT_X;
    eyebrowEl.textContent = 'THAT TIMELINE GOT BUMPY';
    setTitle('Game', 'over.');
    messageEl.textContent = `Score: ${pad(state.score)}. Try ${ERAS[state.eraIndex].name.toLowerCase()} again ${fromCheckpoint ? 'from the checkpoint flag' : 'from the start of the era'} with full lives, or start over.`;
    actionButton.textContent = fromCheckpoint ? 'Retry from Checkpoint' : 'Retry Era';
    actionHandler = retry;
    restartButton.hidden = false;
    restartButton.textContent = 'Start Over';
  }
  // Keyboard players land on the main choice, so Enter continues. The start screen is skipped
  // because Enter already starts the game there and would otherwise fire twice.
  if (state.phase !== 'start') (actionButton.hidden ? restartButton : actionButton).focus({ preventScroll: true });
}

/** Fills an element with three stars, the unearned ones dimmed. */
function renderStarIcons(target: HTMLElement, stars: number): void {
  target.replaceChildren(...[0, 1, 2].map(i => {
    const star = document.createElement('span');
    star.textContent = '★';
    if (i >= stars) star.className = 'star-off';
    return star;
  }));
  target.setAttribute('aria-label', `${stars} of 3 stars`);
}

/** Star rating for the era just cleared, with tips for any stars missed. */
function renderStars(): void {
  renderStarIcons(starRowEl, state.lastStars);
  const tips = [];
  if (state.eraPickups < STAR_PICKUPS) tips.push(`collect ${STAR_PICKUPS} pickups`);
  if (state.eraHits > 0) tips.push('take no damage');
  starHintEl.textContent = tips.length
    ? `${newBestStars ? 'New best! ' : ''}Next time, ${tips.join(' and ')} for more stars.`
    : `${newBestStars ? 'New best! ' : ''}Perfect era!`;
}

function hideOverlay(): void {
  screen++;
  overlay.classList.add('hidden');
  actionButton.blur();
  restartButton.blur();
  actionButton.hidden = false;
  restartButton.hidden = true;
}

function start(): void {
  sound.start();
  online.startRun();
  beginGame(state);
  updateHud();
  hideOverlay();
}

function advance(): void {
  sound.play('advance');
  advanceEra(state);
  progress.reach(state.eraIndex);
  updateHud();
  if (state.phase === 'victory') {
    showOverlay();
    sound.play('fanfare');
    celebrate(reducedMotion());
    void submitRun('victory');
  } else hideOverlay();
}

function retry(): void {
  sound.start();
  if (state.mode === 'campaign') online.continueRun();
  retryEra(state);
  updateHud();
  hideOverlay();
}

/** Sends the finished run in the background and shows the outcome on the end screen. */
async function submitRun(outcome: RunOutcome): Promise<void> {
  if (state.mode === 'practice') {
    renderNote(onlineEl, "Practice run: it doesn't go on the leaderboard.");
    return;
  }
  const shownOn = screen;
  renderNote(onlineEl, 'Saving your score…');
  const result = await online.finishRun({ score: state.score, eraReached: state.eraIndex + 1, outcome });
  if (shownOn === screen) renderFinishResult(onlineEl, result, online);
}

const ownBoardName = () => (online.player?.listed ? online.player.displayName : null);

async function refreshBoard(view: number): Promise<boolean> {
  const entries = await online.leaderboard();
  if (view !== boardView) return false;
  renderLeaderboard(boardList, boardStatus, entries, ownBoardName());
  return entries !== null;
}

async function openBoard(): Promise<void> {
  const view = ++boardView;
  boardStatus.textContent = 'Loading…';
  boardList.replaceChildren();
  boardJoin.replaceChildren();
  boardOverlay.classList.remove('hidden');
  boardClose.focus({ preventScroll: true });
  const loaded = await refreshBoard(view);
  if (loaded && view === boardView && !online.player?.listed) {
    renderJoinPrompt(boardJoin, online, { question: 'Want to be on the leaderboard?', allowDecline: false, onDone: () => void refreshBoard(view) });
  }
}

/** Starts any reached era as practice, from the era map. */
function startPractice(eraIndex: number): void {
  closeMap(false);
  sound.start();
  beginGame(state, eraIndex, 'practice');
  updateHud();
  hideOverlay();
}

function renderMap(): void {
  const { stars } = progress.current;
  eraGrid.replaceChildren(...ERAS.map((era, i) => {
    const item = document.createElement('li');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'era-card';
    const unlocked = progress.isUnlocked(i);
    card.disabled = !unlocked;
    const num = document.createElement('span');
    num.className = 'era-num';
    num.textContent = String(i + 1);
    const name = document.createElement('span');
    name.textContent = era.name;
    const badge = document.createElement('span');
    badge.className = 'era-stars';
    if (unlocked) renderStarIcons(badge, stars[i]); else badge.textContent = '🔒';
    card.append(num, name, badge);
    card.setAttribute('aria-label', unlocked ? `Era ${i + 1}, ${era.name}, ${stars[i]} of 3 stars` : `Era ${i + 1}, ${era.name}, locked`);
    card.addEventListener('click', () => startPractice(i));
    item.append(card);
    return item;
  }));
}

function openMap(): void {
  renderMap();
  mapOverlay.classList.remove('hidden');
  eraGrid.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
}

function closeMap(restoreFocus = true): void {
  mapOverlay.classList.add('hidden');
  if (restoreFocus) erasButton.focus({ preventScroll: true });
}

function closeBoard(): void {
  boardView++;
  boardOverlay.classList.add('hidden');
  leaderboardButton.focus({ preventScroll: true });
}

function renderToggle(button: HTMLButtonElement, on: boolean, label: string, onText: string, offText: string): void {
  button.textContent = on ? onText : offText;
  button.setAttribute('aria-pressed', String(on));
  button.setAttribute('aria-label', `Turn ${label} ${on ? 'off' : 'on'}`);
}

actionButton.addEventListener('click', () => actionHandler());
leaderboardButton.addEventListener('click', () => void openBoard());
erasButton.addEventListener('click', openMap);
mapClose.addEventListener('click', () => closeMap());
boardClose.addEventListener('click', closeBoard);
window.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !boardOverlay.classList.contains('hidden')) closeBoard();
  if (event.key === 'Escape' && !mapOverlay.classList.contains('hidden')) closeMap();
});
restartButton.addEventListener('click', start);

let soundOn = prefs.get('sound', true);
sound.setEnabled(soundOn);
renderToggle(soundButton, soundOn, 'sound', '♫', '×');
soundButton.addEventListener('click', () => {
  soundOn = sound.toggle();
  prefs.set('sound', soundOn);
  renderToggle(soundButton, soundOn, 'sound', '♫', '×');
});

state.scaresEnabled = prefs.get('scares', true);
renderToggle(scaresButton, state.scaresEnabled, 'jump scares', '👻', '👻');
scaresButton.addEventListener('click', () => {
  state.scaresEnabled = !state.scaresEnabled;
  if (!state.scaresEnabled) state.scare = null;
  prefs.set('scares', state.scaresEnabled);
  renderToggle(scaresButton, state.scaresEnabled, 'jump scares', '👻', '👻');
});

const keys = bindInput(document, {
  onJump: () => requestJump(state),
  onEnter: () => { if (state.phase === 'start' && boardOverlay.classList.contains('hidden') && mapOverlay.classList.contains('hidden')) start(); }
});

let lastTime = 0;
function frame(timestamp: number): void {
  const dt = frameDelta(timestamp, lastTime);
  lastTime = timestamp;
  for (const event of step(state, keys, dt)) {
    // Pickups in a combo climb in pitch instead of repeating the plain collect sound.
    if (event === 'collect') { if (state.combo.count >= 2) sound.combo(state.combo.count); else sound.play('collect'); }
    if (event === 'jump' || event === 'extraLife' || event === 'hit' || event === 'checkpoint' || event === 'powerup' || event === 'shieldBreak') sound.play(event);
    if (event === 'extraLife') pulseHearts();
    if (event === 'scare' && state.scare) sound.scare(state.scare.kind);
    if (event === 'collect' || event === 'hit') updateHud();
    if (event === 'clear') {
      newBestStars = progress.recordClear(state.eraIndex, state.lastStars);
      if (state.lastStars === 3) {
        sound.play('fanfare');
        celebrate(reducedMotion());
      } else sound.play('star');
    }
    if (event === 'clear' || event === 'gameover') showOverlay();
    if (event === 'gameover') void submitRun('gameover');
  }
  draw(state, timestamp / 1000);
  drawScareLayer(state.scare);
  requestAnimationFrame(frame);
}

// Development-only hook for browser tests; stripped from production builds.
if (import.meta.env.DEV) (window as Window & { __chronokid?: { state: GameState } }).__chronokid = { state };

updateHud();
showOverlay();
requestAnimationFrame(frame);
