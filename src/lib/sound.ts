const SOUND_STORAGE_KEY = 'nongki:picker-sound';

type WebkitAudioWindow = Window & {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
};

export interface SoundStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

interface ToneOptions {
  freq: number;
  startOffset?: number;
  duration: number;
  type: OscillatorType;
  peakGain: number;
}

let audioCtx: AudioContext | null = null;
let cachedEnabled: boolean | null = null;

function getStorage(): SoundStorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    if (typeof localStorage.getItem !== 'function' || typeof localStorage.setItem !== 'function') {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
}

export function isPickerSoundEnabled(storage: SoundStorageLike | null = getStorage()): boolean {
  if (cachedEnabled !== null && storage === getStorage()) {
    return cachedEnabled;
  }
  try {
    const enabled = storage?.getItem(SOUND_STORAGE_KEY) !== 'off';
    if (storage === getStorage()) cachedEnabled = enabled;
    return enabled;
  } catch {
    return cachedEnabled ?? true;
  }
}

export function setPickerSoundEnabled(
  enabled: boolean,
  storage: SoundStorageLike | null = getStorage(),
): boolean {
  cachedEnabled = enabled;
  try {
    storage?.setItem(SOUND_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore storage errors (private browsing or disabled storage).
  }
  return enabled;
}

export function togglePickerSound(storage: SoundStorageLike | null = getStorage()): boolean {
  return setPickerSoundEnabled(!isPickerSoundEnabled(storage), storage);
}

export function resetSoundStateForTest(): void {
  audioCtx = null;
  cachedEnabled = null;
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioCtx) {
    const win = window as WebkitAudioWindow;
    const AudioCtor = win.AudioContext ?? win.webkitAudioContext;
    if (typeof AudioCtor !== 'function') return null;
    try {
      audioCtx = new AudioCtor();
    } catch {
      return null;
    }
  }

  if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
    void audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

function playTone(ctx: AudioContext, options: ToneOptions): void {
  const { freq, startOffset = 0, duration, type, peakGain } = options;
  const start = ctx.currentTime + startOffset;
  const end = start + duration;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  // Soft 8ms attack and exponential decay prevent audible speaker clicks.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + Math.min(0.008, duration * 0.4));
  gain.gain.exponentialRampToValueAtTime(0.0001, end);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };

  osc.start(start);
  osc.stop(end + 0.01);
}

/** Plays a short pitched tick during the random-picker spin animation. */
export function playPickerTick(step: number, totalSteps: number): void {
  if (!isPickerSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const progress = totalSteps > 0 ? Math.min(1, Math.max(0, step / totalSteps)) : 0;
  playTone(ctx, {
    freq: 340 + progress * 260,
    duration: 0.045,
    type: 'triangle',
    peakGain: 0.07,
  });
}

/** Plays an ascending three-note chime when a random cafe pick is revealed. */
export function playPickerReveal(): void {
  if (!isPickerSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [
    { freq: 523.25, offset: 0, duration: 0.22 },
    { freq: 659.25, offset: 0.07, duration: 0.22 },
    { freq: 783.99, offset: 0.14, duration: 0.32 },
  ];

  for (const note of notes) {
    playTone(ctx, {
      freq: note.freq,
      startOffset: note.offset,
      duration: note.duration,
      type: 'sine',
      peakGain: 0.08,
    });
  }
}
