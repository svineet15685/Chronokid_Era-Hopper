import { describe, expect, it } from 'vitest';
import { ERAS } from './game/config';
import { buildLevel, createGame, type GameState } from './game/simulation';
import { sanitizeProgress, type Progress } from './progress';
import { STICKERS, StickerBook, sanitizeStickers, type StickerData, type StickerStore } from './stickers';

function memoryStore(initial?: unknown): StickerStore & { saved: StickerData | null } {
  return {
    saved: null,
    load() { return sanitizeStickers(initial ?? null); },
    save(data) { this.saved = data; }
  };
}

function game(eraIndex = 0): GameState {
  const state = createGame();
  buildLevel(state, eraIndex);
  return state;
}

const noProgress = (): Progress => sanitizeProgress(null);
const ids = (stickers: { id: string }[]) => stickers.map(s => s.id);

describe('stickers', () => {
  it('has unique ids and a goal for every sticker', () => {
    expect(new Set(STICKERS.map(s => s.id)).size).toBe(STICKERS.length);
    for (const sticker of STICKERS) expect(sticker.goal.length).toBeGreaterThan(5);
  });

  it('awards era-clear stickers from how the era went', () => {
    const book = new StickerBook(memoryStore());
    const state = game(0);
    state.eraPickups = 25;
    state.eraHits = 0;
    state.lastStars = 3;
    expect(ids(book.onEvent('clear', state, noProgress()))).toEqual(['first-clear', 'full-basket', 'berry-picker', 'untouchable', 'superstar']);
    // Already earned: nothing new the second time.
    expect(book.onEvent('clear', state, noProgress())).toEqual([]);
  });

  it('only gives Berry Picker in the Stone Age, and Brave Heart on hard', () => {
    const book = new StickerBook(memoryStore());
    const state = game(1);
    state.eraPickups = 25;
    state.eraHits = 2;
    state.lastStars = 2;
    state.difficulty = 'hard';
    expect(ids(book.onEvent('clear', state, noProgress()))).toEqual(['first-clear', 'full-basket', 'brave-heart']);
  });

  it('gives Star Collector once all 30 stars are recorded', () => {
    const book = new StickerBook(memoryStore());
    const progress = { ...noProgress(), stars: ERAS.map(() => 3) };
    expect(ids(book.onEvent('clear', game(9), progress))).toContain('star-collector');
  });

  it('counts a x5 combo', () => {
    const book = new StickerBook(memoryStore());
    const state = game();
    state.combo.count = 4;
    expect(book.onEvent('collect', state, noProgress())).toEqual([]);
    state.combo.count = 5;
    expect(ids(book.onEvent('collect', state, noProgress()))).toEqual(['combo-champ']);
  });

  it('remembers power-ups tried across games for Power Player', () => {
    const store = memoryStore();
    const state = game();
    let book = new StickerBook(store);
    for (const kind of ['shield', 'freeze', 'magnet'] as const) {
      state.lastPower = kind;
      expect(book.onEvent('powerup', state, noProgress())).toEqual([]);
    }
    book = new StickerBook(memoryStore(store.saved));
    state.lastPower = 'doubleJump';
    expect(ids(book.onEvent('powerup', state, noProgress()))).toEqual(['power-player']);
  });

  it('knows a boss was beaten without a hit, and which boss', () => {
    const book = new StickerBook(memoryStore());
    const state = game(4);
    if (!state.boss) throw new Error('no boss');
    expect(state.boss.kind).toBe('kraken');
    state.eraHits = 2; // hits before the fight do not count
    state.boss.phase = 'intro';
    book.onEvent('bossRoar', state, noProgress());
    state.boss.phase = 'telegraph';
    book.onEvent('bossRoar', state, noProgress());
    expect(ids(book.onEvent('bossDefeated', state, noProgress()))).toEqual(['boss-bonker', 'flawless', 'kraken-tamer']);
  });

  it('does not give Flawless when the boss landed a hit', () => {
    const book = new StickerBook(memoryStore());
    const state = game(0);
    if (!state.boss) throw new Error('no boss');
    state.boss.phase = 'intro';
    book.onEvent('bossRoar', state, noProgress());
    state.eraHits = 1;
    expect(ids(book.onEvent('bossDefeated', state, noProgress()))).toEqual(['boss-bonker']);
  });

  it('gives Explorer for a secret room and Master Explorer for all ten', () => {
    const book = new StickerBook(memoryStore());
    const progress = { ...noProgress(), secrets: ERAS.map((_, i) => i < 3) };
    expect(ids(book.onEvent('secretEnter', game(), progress))).toEqual(['explorer']);
    expect(ids(book.onEvent('secretEnter', game(), { ...progress, secrets: ERAS.map(() => true) }))).toEqual(['master-explorer']);
  });

  it('awards UI stickers directly, once, and saves them', () => {
    const store = memoryStore();
    const book = new StickerBook(store);
    expect(book.award('dress-up')?.name).toBe('Dress Up');
    expect(book.award('dress-up')).toBeNull();
    expect(store.saved?.earned).toEqual(['dress-up']);
    expect(book.count).toBe(1);
  });

  it('ignores corrupted or tampered saved data', () => {
    expect(sanitizeStickers('nope')).toEqual({ earned: [], powers: [] });
    expect(sanitizeStickers({ earned: ['explorer', 'explorer', 'hacker', 7], powers: ['magnet', 'laser'] })).toEqual({ earned: ['explorer'], powers: ['magnet'] });
  });
});
