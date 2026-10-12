import { describe, expect, it } from 'vitest';
import { MAX_RUN_MS, MIN_ERA_MS, checkRunPlausibility, createPlayerBody, finishRunBody, leaderboardQuery } from '../src/validation.js';

describe('display names', () => {
  it.each([
    ['Ada', 'Ada'],
    ['  Mia   Rose  ', 'Mia Rose'],
    ['Zoë', 'Zoë'],
    ['小明', '小明'],
    ["O'Brien-2", "O'Brien-2"],
    ['Ｆｕｌｌ', 'Full'],
    ['tab\tname', 'tab name']
  ])('accepts and normalizes %j', (input, expected) => {
    expect(createPlayerBody.parse({ displayName: input }).displayName).toBe(expected);
  });

  it.each(['', '   ', 'a'.repeat(25), '<script>', 'hi\u{1F600}', '-dash', 'null\u0000byte', `right${String.fromCharCode(0x202e)}left`])('rejects %j', input => {
    expect(createPlayerBody.safeParse({ displayName: input }).success).toBe(false);
  });

  it('rejects missing, wrongly typed, and extra fields', () => {
    expect(createPlayerBody.safeParse({}).success).toBe(false);
    expect(createPlayerBody.safeParse({ displayName: 7 }).success).toBe(false);
    expect(createPlayerBody.safeParse({ displayName: 'Ada', admin: true }).success).toBe(false);
  });
});

describe('finish run body', () => {
  const valid = { score: 1500, eraReached: 2, outcome: 'gameover' };

  it('accepts a normal result', () => {
    expect(finishRunBody.parse(valid)).toEqual(valid);
  });

  it.each([
    { score: -100 },
    { score: 150 },
    { score: 1.5 },
    { score: 25_100 },
    { score: '100' },
    { eraReached: 0 },
    { eraReached: 11 },
    { outcome: 'won' },
    { lives: 3 }
  ])('rejects %j', change => {
    expect(finishRunBody.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

describe('run plausibility', () => {
  const run = (score: number, eraReached: number, outcome: 'gameover' | 'victory' = 'gameover') => ({ score, eraReached, outcome });

  it('accepts what the game makes possible', () => {
    expect(checkRunPlausibility(run(0, 1), 1_000)).toBeNull();
    expect(checkRunPlausibility(run(2500, 1), 20_000)).toBeNull();
    expect(checkRunPlausibility(run(25_000, 10, 'victory'), 10 * MIN_ERA_MS)).toBeNull();
  });

  it('rejects more points than the eras reached contain', () => {
    expect(checkRunPlausibility(run(2600, 1), 60_000)).toBe('score_exceeds_eras');
  });

  it('rejects a victory before the last era', () => {
    expect(checkRunPlausibility(run(5000, 9, 'victory'), 600_000)).toBe('victory_before_last_era');
  });

  it('rejects runs faster than the eras allow', () => {
    expect(checkRunPlausibility(run(1000, 5), 4 * MIN_ERA_MS - 1)).toBe('too_fast');
    expect(checkRunPlausibility(run(1000, 5), 4 * MIN_ERA_MS)).toBeNull();
    expect(checkRunPlausibility(run(25_000, 10, 'victory'), 9.5 * MIN_ERA_MS)).toBe('too_fast');
  });

  it('rejects runs finished too long after starting', () => {
    expect(checkRunPlausibility(run(100, 1), MAX_RUN_MS + 1)).toBe('expired');
  });
});

describe('leaderboard query', () => {
  it('defaults and bounds the limit', () => {
    expect(leaderboardQuery.parse({})).toEqual({ limit: 10 });
    expect(leaderboardQuery.parse({ limit: '25' })).toEqual({ limit: 25 });
    for (const limit of ['0', '51', 'abc', '2.5']) expect(leaderboardQuery.safeParse({ limit }).success).toBe(false);
    expect(leaderboardQuery.safeParse({ limit: '5', sort: 'asc' }).success).toBe(false);
  });
});
