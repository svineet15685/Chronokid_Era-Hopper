// Synthesized sound effects; no external audio assets.
import type { ScareKind } from './config';

export type SoundName = 'jump' | 'collect' | 'extraLife' | 'hit' | 'advance' | 'checkpoint' | 'powerup' | 'shieldBreak' | 'star';

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}

const SCARE_VOICES: Record<ScareKind, 'roar' | 'boo' | 'howl' | 'horn' | 'hiss' | 'buzz' | 'ticktock'> = {
  trex: 'roar', mummy: 'boo', wolf: 'howl', dragon: 'roar', kraken: 'roar',
  train: 'horn', ghost: 'boo', steambot: 'hiss', robot: 'buzz', timeeater: 'ticktock'
};

export function createSound() {
  let audioContext: AudioContext | null = null;
  let enabled = true;

  /** Creates or resumes the context; call from a user gesture so browsers allow playback. */
  function start(): AudioContext | null {
    if (!enabled) return null;
    try {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!audioContext && Context) audioContext = new Context();
      if (audioContext?.state === 'suspended') void audioContext.resume();
      return audioContext;
    } catch {
      return null;
    }
  }

  function tone(frequency: number, duration: number, type: OscillatorType = 'square', volume = 0.045, endFrequency = frequency, delay = 0, vibrato = 0): void {
    const audio = start();
    if (!audio) return;
    const at = audio.currentTime + delay;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), at + duration);
    if (vibrato) {
      const lfo = audio.createOscillator();
      const depth = audio.createGain();
      lfo.frequency.value = 7;
      depth.gain.value = vibrato;
      lfo.connect(depth);
      depth.connect(oscillator.frequency);
      lfo.start(at);
      lfo.stop(at + duration);
    }
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }

  function noise(duration: number, volume: number, filter: BiquadFilterType, frequency: number): void {
    const audio = start();
    if (!audio) return;
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * duration), audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const shaper = audio.createBiquadFilter();
    const gain = audio.createGain();
    source.buffer = buffer;
    shaper.type = filter;
    shaper.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    source.connect(shaper);
    shaper.connect(gain);
    gain.connect(audio.destination);
    source.start();
  }

  function play(name: SoundName): void {
    if (!enabled) return;
    if (name === 'jump') tone(260, 0.11, 'square', 0.035, 430);
    if (name === 'collect') { tone(620, 0.08, 'sine', 0.045, 920); setTimeout(() => tone(920, 0.1, 'sine', 0.035, 1120), 55); }
    if (name === 'hit') tone(180, 0.25, 'sawtooth', 0.05, 65);
    if (name === 'advance') { tone(440, 0.1, 'triangle', 0.035, 660); setTimeout(() => tone(660, 0.16, 'triangle', 0.04, 880), 90); }
    if (name === 'extraLife') [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'square', 0.04, f, i * 0.08));
    if (name === 'powerup') [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.09, 'triangle', 0.04, f * 1.02, i * 0.05));
    if (name === 'shieldBreak') { noise(0.25, 0.06, 'highpass', 3000); tone(1200, 0.2, 'sine', 0.04, 500); }
    if (name === 'star') tone(1319, 0.14, 'sine', 0.045, 1760);
    if (name === 'checkpoint') { tone(523, 0.1, 'triangle', 0.04); tone(659, 0.1, 'triangle', 0.04, 659, 0.09); tone(784, 0.18, 'triangle', 0.045, 784, 0.18); }
  }

  /** A short, startling (but not ear-splitting) creature sound. */
  function scare(kind: ScareKind): void {
    if (!enabled) return;
    switch (SCARE_VOICES[kind]) {
      case 'roar': tone(170, 0.75, 'sawtooth', 0.09, 50); noise(0.55, 0.07, 'lowpass', 700); break;
      case 'boo': tone(340, 0.85, 'sine', 0.11, 165, 0, 28); break;
      case 'howl': tone(300, 0.35, 'sine', 0.08, 620); tone(620, 0.7, 'sine', 0.08, 300, 0.35, 12); break;
      case 'horn': tone(233, 0.75, 'square', 0.05); tone(294, 0.75, 'square', 0.05); noise(0.4, 0.04, 'highpass', 2500); break;
      case 'hiss': noise(0.9, 0.09, 'highpass', 1800); tone(90, 0.5, 'sawtooth', 0.05, 60); break;
      case 'buzz': tone(110, 0.65, 'square', 0.06, 70, 0, 45); noise(0.3, 0.05, 'bandpass', 1200); break;
      case 'ticktock':
        for (let i = 0; i < 4; i++) tone(i % 2 ? 1400 : 1000, 0.05, 'square', 0.05, i % 2 ? 1400 : 1000, i * 0.12);
        tone(150, 0.7, 'sawtooth', 0.08, 45, 0.45);
        break;
    }
  }

  function toggle(): boolean {
    enabled = !enabled;
    if (enabled) start();
    return enabled;
  }

  function setEnabled(on: boolean): void {
    enabled = on;
  }

  return { start, play, scare, toggle, setEnabled };
}
