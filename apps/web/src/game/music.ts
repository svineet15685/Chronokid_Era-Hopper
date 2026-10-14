// Background music, synthesized with Web Audio (no audio files). Each era has a short looping tune;
// a lookahead scheduler queues notes slightly ahead on the audio clock so timing stays steady.
import type { EraId } from './config';

const MAJOR_PENTATONIC = [0, 2, 4, 7, 9];
const MINOR_PENTATONIC = [0, 3, 5, 7, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN_DOMINANT = [0, 1, 4, 5, 7, 8, 10];

export interface Tune {
  bpm: number;
  /** MIDI note of the scale's root for the melody; the bass plays an octave lower. */
  root: number;
  scale: readonly number[];
  /** 32 sixteenth-note steps: a digit or letter (a = 10) is a scale degree, '.' is a rest. */
  melody: string;
  /** 8 quarter-note steps in the same notation. */
  bass: string;
  lead: OscillatorType;
  drums: 'none' | 'tribal' | 'march' | 'beat';
}

export const TUNES: Record<EraId, Tune> = {
  stone: { bpm: 104, root: 57, scale: MAJOR_PENTATONIC, melody: '0.2.4.4.2.0...4.2.0.2..0........', bass: '0.0.3.0.', lead: 'triangle', drums: 'tribal' },
  egypt: { bpm: 96, root: 62, scale: PHRYGIAN_DOMINANT, melody: '0.1.2.1.0...4.3.2.1.2.1.0.......', bass: '0.0.0.4.', lead: 'triangle', drums: 'tribal' },
  viking: { bpm: 100, root: 52, scale: MINOR, melody: '0...2.3.4...3.2.0...4.5.4.2.0...', bass: '0.0.5.4.', lead: 'sawtooth', drums: 'march' },
  medieval: { bpm: 112, root: 60, scale: DORIAN, melody: '0.2.3.4.3.2.0.2.4...5.4.3.2.1.0.', bass: '0.4.0.4.', lead: 'triangle', drums: 'march' },
  pirate: { bpm: 132, root: 60, scale: MAJOR, melody: '4.4.5.4.2.0.2.4.5.5.7.5.4.2.4...', bass: '0.4.0.4.', lead: 'square', drums: 'beat' },
  west: { bpm: 118, root: 55, scale: MAJOR_PENTATONIC, melody: '0...2.4.5...4.2.0...2.0.3.2.0...', bass: '0.3.0.3.', lead: 'triangle', drums: 'beat' },
  haunted: { bpm: 90, root: 57, scale: MINOR, melody: '0...3...2...0...5...4...3.2.1...', bass: '0.0.5.5.', lead: 'sine', drums: 'none' },
  steam: { bpm: 120, root: 50, scale: DORIAN, melody: '0.0.3.0.4.0.3.0.5.4.3.2.3.2.1.0.', bass: '0.0.3.4.', lead: 'square', drums: 'march' },
  future: { bpm: 128, root: 57, scale: MINOR_PENTATONIC, melody: '0234342034567654034320230123210.', bass: '0.0.3.4.', lead: 'sawtooth', drums: 'beat' },
  end: { bpm: 140, root: 55, scale: MINOR, melody: '0.4.3.4.5.4.3.2.0.4.3.4.7.6.5.4.', bass: '0.5.3.4.', lead: 'sawtooth', drums: 'beat' }
};

/** Spooky mode: the same tune, slower and in a minor key, on soft sine voices. */
export function spookyVariant(tune: Tune): Tune {
  return { ...tune, bpm: Math.round(tune.bpm * 0.8), scale: MINOR, lead: 'sine', drums: tune.drums === 'none' ? 'none' : 'tribal' };
}

/** "Faster during danger": a little quicker on the last life. */
export function dangerVariant(tune: Tune): Tune {
  return { ...tune, bpm: Math.round(tune.bpm * 1.15) };
}

/** Scale degree in a pattern step, or null for a rest. */
export function degreeAt(pattern: string, index: number): number | null {
  const symbol = pattern[index % pattern.length];
  return symbol === '.' || symbol === undefined ? null : parseInt(symbol, 36);
}

export function midiForDegree(tune: Tune, degree: number, octaveShift = 0): number {
  const { scale } = tune;
  return tune.root + scale[degree % scale.length] + 12 * (Math.floor(degree / scale.length) + octaveShift);
}

export const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const LOOKAHEAD = 0.12;
const STEPS = 32;

export interface Music {
  /** Call every frame: plays `tune` while `active`, otherwise falls silent. */
  update(active: boolean, tune: Tune): void;
}

/** One enveloped note (or a drum thump when `endFreq` sweeps down). */
function voice(audio: AudioContext, output: GainNode, at: number, freq: number, length: number, type: OscillatorType, volume: number, endFreq = freq): void {
  const osc = audio.createOscillator();
  const env = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(endFreq, at + length);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(env).connect(output);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

export function createMusic(getContext: () => AudioContext | null): Music {
  let tune: Tune | null = null;
  let step = 0;
  let nextStepTime = 0;
  let gain: GainNode | null = null;
  let noiseBuffer: AudioBuffer | null = null;

  function hat(audio: AudioContext, output: GainNode, at: number): void {
    if (!noiseBuffer) {
      noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.05), audio.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const env = audio.createGain();
    source.buffer = noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    env.gain.setValueAtTime(0.02, at);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    source.connect(filter).connect(env).connect(output);
    source.start(at);
  }

  function scheduleStep(audio: AudioContext, output: GainNode, current: Tune, index: number, at: number): void {
    const sixteenth = 60 / current.bpm / 4;
    const degree = degreeAt(current.melody, index);
    if (degree !== null) voice(audio, output, at, frequency(midiForDegree(current, degree)), sixteenth * 1.8, current.lead, 0.035);
    if (index % 4 === 0) {
      const bassDegree = degreeAt(current.bass, index / 4);
      if (bassDegree !== null) voice(audio, output, at, frequency(midiForDegree(current, bassDegree, -1)), sixteenth * 3.5, 'triangle', 0.05);
    }
    const beat = index % 16;
    if (current.drums === 'tribal' && (beat === 0 || beat === 10)) voice(audio, output, at, 110, 0.18, 'sine', 0.09, 45);
    if (current.drums === 'march' && beat % 4 === 0) voice(audio, output, at, beat === 0 ? 100 : 160, 0.12, 'sine', 0.07, 50);
    if (current.drums === 'beat') {
      if (beat === 0 || beat === 8) voice(audio, output, at, 120, 0.15, 'sine', 0.09, 40);
      if (beat % 2 === 0) hat(audio, output, at);
    }
  }

  function stop(): void {
    if (!gain) return;
    const fading = gain;
    const audio = fading.context;
    fading.gain.setTargetAtTime(0, audio.currentTime, 0.05);
    setTimeout(() => fading.disconnect(), 400);
    gain = null;
    tune = null;
  }

  return {
    update(active, next) {
      if (!active) {
        stop();
        return;
      }
      const audio = getContext();
      if (!audio) {
        stop();
        return;
      }
      if (!gain) {
        gain = audio.createGain();
        gain.gain.value = 0.7;
        gain.connect(audio.destination);
        step = 0;
        nextStepTime = audio.currentTime + 0.05;
      }
      // A new era restarts the tune; tempo or mood changes carry on from the current step.
      if (tune && (tune.melody !== next.melody || tune.root !== next.root)) step = 0;
      tune = next;
      // After a stall (a busy frame or a paused tab), skip ahead instead of firing a burst of missed notes.
      if (nextStepTime < audio.currentTime - 0.1) nextStepTime = audio.currentTime + 0.02;
      while (nextStepTime < audio.currentTime + LOOKAHEAD) {
        scheduleStep(audio, gain, tune, step % STEPS, nextStepTime);
        nextStepTime += 60 / tune.bpm / 4;
        step++;
      }
    }
  };
}
