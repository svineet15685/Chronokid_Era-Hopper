// Synthesized sound effects; no external audio assets.
export type SoundName = 'jump' | 'collect' | 'hit' | 'advance';

declare global {
  interface Window { webkitAudioContext?: typeof AudioContext }
}

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

  function tone(frequency: number, duration: number, type: OscillatorType = 'square', volume = 0.045, endFrequency = frequency): void {
    const audio = start();
    if (!audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), audio.currentTime + duration);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function play(name: SoundName): void {
    if (!enabled) return;
    if (name === 'jump') tone(260, 0.11, 'square', 0.035, 430);
    if (name === 'collect') { tone(620, 0.08, 'sine', 0.045, 920); setTimeout(() => tone(920, 0.1, 'sine', 0.035, 1120), 55); }
    if (name === 'hit') tone(180, 0.25, 'sawtooth', 0.05, 65);
    if (name === 'advance') { tone(440, 0.1, 'triangle', 0.035, 660); setTimeout(() => tone(660, 0.16, 'triangle', 0.04, 880), 90); }
  }

  function toggle(): boolean {
    enabled = !enabled;
    if (enabled) start();
    return enabled;
  }

  return { start, play, toggle };
}
