// Grown-up settings and the simple gate in front of them, plus the chosen outfit. Stored per device; never sent anywhere.
import { DIFFICULTIES, type Difficulty } from './game/config';
import { isOutfitId, type OutfitId } from './game/hero';

/** How jump scares look. Chosen by a grown-up; the kid's 👻 toggle only turns them on and off. */
export type ScareStyle = 'off' | 'silly' | 'spooky';

const STYLE_KEY = 'chronokid.scareStyle';
const STYLES: readonly ScareStyle[] = ['off', 'silly', 'spooky'];

export function loadScareStyle(): ScareStyle {
  try {
    const value = localStorage.getItem(STYLE_KEY);
    return STYLES.includes(value as ScareStyle) ? (value as ScareStyle) : 'silly';
  } catch {
    return 'silly';
  }
}

export function saveScareStyle(style: ScareStyle): void {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    /* not persisted */
  }
}

const DIFFICULTY_KEY = 'chronokid.difficulty';

export function loadDifficulty(): Difficulty {
  try {
    const value = localStorage.getItem(DIFFICULTY_KEY);
    return value !== null && value in DIFFICULTIES ? (value as Difficulty) : 'normal';
  } catch {
    return 'normal';
  }
}

export function saveDifficulty(difficulty: Difficulty): void {
  try {
    localStorage.setItem(DIFFICULTY_KEY, difficulty);
  } catch {
    /* not persisted */
  }
}

const OUTFIT_KEY = 'chronokid.outfit';

/** The chosen outfit, or Classic when nothing (or something unknown) is stored. */
export function loadOutfit(): OutfitId {
  try {
    const value = localStorage.getItem(OUTFIT_KEY);
    return isOutfitId(value) ? value : 'classic';
  } catch {
    return 'classic';
  }
}

export function saveOutfit(outfit: OutfitId): void {
  try {
    localStorage.setItem(OUTFIT_KEY, outfit);
  } catch {
    /* not persisted */
  }
}

export interface GateQuestion {
  text: string;
  answer: number;
  /** Four distinct choices, one of them the answer, in random order. */
  choices: number[];
}

/**
 * A multiplication a grown-up answers instantly but a young child usually cannot, the common
 * "parental gate" pattern. It keeps settings out of casual reach; it is not a security control.
 */
export function makeGateQuestion(random: () => number = Math.random): GateQuestion {
  const a = 6 + Math.floor(random() * 4);
  const b = 6 + Math.floor(random() * 4);
  const answer = a * b;
  const choices = new Set([answer]);
  for (const near of [answer + a, answer - b, answer + 10, answer - 10, answer + 1, answer - 1]) {
    if (choices.size === 4) break;
    if (near > 0) choices.add(near);
  }
  const list = [...choices];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return { text: `What is ${a} × ${b}?`, answer, choices: list };
}
