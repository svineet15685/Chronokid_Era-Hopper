import { describe, expect, it } from 'vitest';
import { makeGateQuestion } from './settings';

describe('grown-ups gate', () => {
  it('asks a single-digit multiplication with four distinct choices including the answer', () => {
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 200; i++) {
      const question = makeGateQuestion(random);
      const [, a, b] = /What is (\d) × (\d)\?/.exec(question.text) ?? [];
      expect(Number(a) * Number(b)).toBe(question.answer);
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices).size).toBe(4);
      expect(question.choices).toContain(question.answer);
      expect(question.choices.every(c => c > 0)).toBe(true);
    }
  });
});
