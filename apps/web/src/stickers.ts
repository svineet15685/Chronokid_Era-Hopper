// Sticker book: goals kids can aim for, earned during play and kept per device (never sent anywhere).
// The rules are pure checks on game events and state, so they can be unit tested without a browser.
import { GAME_RULES } from '@chronokid/shared';
import { ERAS } from './game/config';
import type { GameEvent, GameState, PowerKind } from './game/simulation';
import { totalStars, type Progress } from './progress';

export interface StickerDef {
  id: string;
  emoji: string;
  name: string;
  /** What to do to earn it, shown in the sticker book even before it is earned. */
  goal: string;
}

export const STICKERS = [
  { id: 'first-clear', emoji: '👣', name: 'First Hop', goal: 'Finish your first era.' },
  { id: 'berry-picker', emoji: '🍓', name: 'Berry Picker', goal: 'Collect every berry in the Stone Age.' },
  { id: 'full-basket', emoji: '🧺', name: 'Full Basket', goal: 'Collect all 25 goodies in any era.' },
  { id: 'untouchable', emoji: '🛡️', name: 'Untouchable', goal: 'Finish an era without getting hit.' },
  { id: 'superstar', emoji: '⭐', name: 'Superstar', goal: 'Earn 3 stars in an era.' },
  { id: 'star-collector', emoji: '🌟', name: 'Star Collector', goal: 'Earn all 30 stars.' },
  { id: 'combo-champ', emoji: '🔥', name: 'Combo Champ', goal: 'Grab 5 goodies in a row for a x5 combo.' },
  { id: 'lucky-heart', emoji: '💖', name: 'Lucky Heart', goal: 'Score enough points for an extra life.' },
  { id: 'power-player', emoji: '⚡', name: 'Power Player', goal: 'Try all 4 power-ups.' },
  { id: 'bubble-save', emoji: '🫧', name: 'Saved by the Bubble', goal: 'Let a shield block a hit.' },
  { id: 'explorer', emoji: '🔍', name: 'Explorer', goal: 'Find a secret room.' },
  { id: 'master-explorer', emoji: '🗺️', name: 'Master Explorer', goal: 'Find all 10 secret rooms.' },
  { id: 'boss-bonker', emoji: '💥', name: 'Boss Bonker', goal: 'Beat your first boss.' },
  { id: 'flawless', emoji: '🏅', name: 'Flawless', goal: 'Beat a boss without getting hit.' },
  { id: 'kraken-tamer', emoji: '🐙', name: 'Kraken Tamer', goal: 'Beat the Kraken without getting hit.' },
  { id: 'brave-heart', emoji: '🦁', name: 'Brave Heart', goal: 'Finish an era on Hard.' },
  { id: 'dress-up', emoji: '👕', name: 'Dress Up', goal: 'Wear a new look from the wardrobe.' },
  { id: 'time-champion', emoji: '👑', name: 'Time Champion', goal: 'Beat the Time Eater and finish all 10 eras.' }
] as const satisfies readonly StickerDef[];

export type StickerId = (typeof STICKERS)[number]['id'];

const STICKER_IDS: ReadonlySet<string> = new Set(STICKERS.map(s => s.id));
const POWER_KINDS: readonly PowerKind[] = ['shield', 'freeze', 'magnet', 'doubleJump'];
export const COMBO_GOAL = 5;

export interface StickerData {
  earned: StickerId[];
  /** Power-up kinds tried so far (for Power Player). */
  powers: PowerKind[];
}

export interface StickerStore {
  load(): StickerData;
  save(data: StickerData): void;
}

const STORAGE_KEY = 'chronokid.stickers';

/** Accepts only known sticker and power-up names; anything else is dropped. */
export function sanitizeStickers(value: unknown): StickerData {
  const data: StickerData = { earned: [], powers: [] };
  if (typeof value !== 'object' || value === null) return data;
  const { earned, powers } = value as Partial<Record<keyof StickerData, unknown>>;
  if (Array.isArray(earned)) data.earned = [...new Set(earned.filter((id): id is StickerId => typeof id === 'string' && STICKER_IDS.has(id)))];
  if (Array.isArray(powers)) data.powers = [...new Set(powers.filter((kind): kind is PowerKind => POWER_KINDS.includes(kind)))];
  return data;
}

export const browserStickerStore: StickerStore = {
  load() {
    try {
      return sanitizeStickers(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
    } catch {
      return { earned: [], powers: [] };
    }
  },
  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* not persisted */
    }
  }
};

export class StickerBook {
  private data: StickerData;
  /** Hits taken before the current boss fight began (to spot a no-hit boss win). */
  private hitsBeforeBoss = 0;

  constructor(private readonly store: StickerStore = browserStickerStore) {
    this.data = store.load();
  }

  has(id: StickerId): boolean {
    return this.data.earned.includes(id);
  }

  get count(): number {
    return this.data.earned.length;
  }

  /** Awards a sticker; returns it the first time, or null if it was already earned. */
  award(id: StickerId): StickerDef | null {
    if (this.has(id)) return null;
    this.data = { ...this.data, earned: [...this.data.earned, id] };
    this.store.save(this.data);
    return STICKERS.find(s => s.id === id) ?? null;
  }

  /**
   * Checks the goals touched by one game event and returns any stickers newly earned. Call it after
   * progress has recorded the event (era clears and secret rooms), so totals are up to date.
   */
  onEvent(event: GameEvent, state: Readonly<GameState>, progress: Readonly<Progress>): StickerDef[] {
    const ids: StickerId[] = [];
    switch (event) {
      case 'clear':
        ids.push('first-clear');
        if (state.eraPickups >= GAME_RULES.pickupsPerEra) ids.push('full-basket');
        if (state.eraPickups >= GAME_RULES.pickupsPerEra && ERAS[state.eraIndex].collectible === 'berry') ids.push('berry-picker');
        if (state.eraHits === 0) ids.push('untouchable');
        if (state.lastStars === 3) ids.push('superstar');
        if (totalStars(progress) === ERAS.length * 3) ids.push('star-collector');
        if (state.difficulty === 'hard') ids.push('brave-heart');
        break;
      case 'collect':
        if (state.combo.count >= COMBO_GOAL) ids.push('combo-champ');
        break;
      case 'extraLife':
        ids.push('lucky-heart');
        break;
      case 'powerup':
        if (state.lastPower && !this.data.powers.includes(state.lastPower)) {
          this.data = { ...this.data, powers: [...this.data.powers, state.lastPower] };
          this.store.save(this.data);
        }
        if (POWER_KINDS.every(kind => this.data.powers.includes(kind))) ids.push('power-player');
        break;
      case 'shieldBreak':
        ids.push('bubble-save');
        break;
      case 'secretEnter':
        ids.push('explorer');
        if (progress.secrets.every(Boolean)) ids.push('master-explorer');
        break;
      case 'bossRoar':
        if (state.boss?.phase === 'intro') this.hitsBeforeBoss = state.eraHits;
        break;
      case 'bossDefeated': {
        ids.push('boss-bonker');
        const noHit = state.eraHits === this.hitsBeforeBoss;
        if (noHit) ids.push('flawless');
        if (noHit && state.boss?.kind === 'kraken') ids.push('kraken-tamer');
        break;
      }
    }
    return ids.map(id => this.award(id)).filter((s): s is StickerDef => s !== null);
  }
}
