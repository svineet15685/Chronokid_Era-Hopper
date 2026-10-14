import { describe, expect, it } from 'vitest';
import { ERAS } from './config';
import { TUNES, createMusic, dangerVariant, degreeAt, frequency, midiForDegree, spookyVariant } from './music';

/** A minimal fake AudioContext that counts scheduled oscillators and lets tests move the clock. */
function fakeAudio() {
  const param = () => ({ value: 0, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, setTargetAtTime: () => {} });
  const node = () => ({ connect: (next: unknown) => next, disconnect: () => {} });
  const audio = {
    currentTime: 0,
    sampleRate: 8000,
    destination: node(),
    started: 0,
    createOscillator() { return { ...node(), type: 'sine', frequency: param(), start: () => { audio.started++; }, stop: () => {} }; },
    createGain() { return { ...node(), gain: param(), context: audio }; },
    createBiquadFilter() { return { ...node(), type: 'lowpass', frequency: param() }; },
    createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; },
    createBufferSource() { return { ...node(), buffer: null, start: () => {} }; }
  };
  return audio;
}

describe('tunes', () => {
  it('has one tune per era with 32 melody steps and 8 bass steps', () => {
    for (const era of ERAS) {
      const tune = TUNES[era.id];
      expect(tune.melody).toHaveLength(32);
      expect(tune.bass).toHaveLength(8);
      expect(tune.melody).toMatch(/^[0-9a-z.]+$/);
      expect(tune.bpm).toBeGreaterThan(60);
    }
  });

  it('keeps every note in a comfortable range', () => {
    const notes = (pattern: string, steps: number) =>
      Array.from({ length: steps }, (_, i) => degreeAt(pattern, i)).filter((d): d is number => d !== null);
    for (const tune of Object.values(TUNES)) {
      const melody = notes(tune.melody, 32).map(d => midiForDegree(tune, d));
      const bass = notes(tune.bass, 8).map(d => midiForDegree(tune, d, -1));
      expect(Math.max(...melody)).toBeLessThanOrEqual(84);
      expect(Math.min(...bass)).toBeGreaterThanOrEqual(36);
    }
  });

  it('reads pattern steps and converts notes to pitches', () => {
    expect(degreeAt('0.2a', 0)).toBe(0);
    expect(degreeAt('0.2a', 1)).toBeNull();
    expect(degreeAt('0.2a', 3)).toBe(10);
    expect(frequency(69)).toBe(440);
    expect(midiForDegree(TUNES.stone, 5)).toBe(TUNES.stone.root + 12);
  });

  it('makes spooky tunes slower and minor, and danger tunes faster', () => {
    const spooky = spookyVariant(TUNES.pirate);
    expect(spooky.bpm).toBeLessThan(TUNES.pirate.bpm);
    expect(spooky.scale).toEqual([0, 2, 3, 5, 7, 8, 10]);
    expect(spooky.melody).toBe(TUNES.pirate.melody);
    expect(dangerVariant(TUNES.pirate).bpm).toBeGreaterThan(TUNES.pirate.bpm);
  });
});

describe('music scheduler', () => {
  it('plays only while active, a little ahead of the clock', () => {
    const audio = fakeAudio();
    const music = createMusic(() => audio as unknown as AudioContext);
    music.update(false, TUNES.future);
    expect(audio.started).toBe(0);
    music.update(true, TUNES.future);
    const firstBatch = audio.started;
    expect(firstBatch).toBeGreaterThan(0);
    music.update(true, TUNES.future);
    expect(audio.started).toBe(firstBatch); // nothing new until the clock moves on
    audio.currentTime = 2;
    music.update(true, TUNES.future);
    expect(audio.started).toBeGreaterThan(firstBatch);
    const beforeStop = audio.started;
    music.update(false, TUNES.future);
    audio.currentTime = 4;
    music.update(false, TUNES.future);
    expect(audio.started).toBe(beforeStop);
  });

  it('skips ahead after a stall instead of firing a burst of notes', () => {
    const audio = fakeAudio();
    const music = createMusic(() => audio as unknown as AudioContext);
    music.update(true, TUNES.stone);
    const before = audio.started;
    audio.currentTime = 600;
    music.update(true, TUNES.stone);
    expect(audio.started - before).toBeLessThan(20);
  });

  it('stays silent without an audio context (sound turned off)', () => {
    const music = createMusic(() => null);
    expect(() => music.update(true, TUNES.stone)).not.toThrow();
  });
});
