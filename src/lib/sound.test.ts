import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isPickerSoundEnabled,
  playPickerReveal,
  playPickerTick,
  resetSoundStateForTest,
  setPickerSoundEnabled,
  togglePickerSound,
  type SoundStorageLike,
} from './sound';

function createMemoryStorage(): SoundStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

function createMockAudioContext() {
  const oscillators: Array<{
    type: OscillatorType;
    frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }> = [];

  const ctx = {
    currentTime: 0,
    state: 'running' as AudioContextState,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    createOscillator: vi.fn(() => {
      const osc = {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: vi.fn() },
        start: vi.fn(),
        stop: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        onended: null as (() => void) | null,
      };
      oscillators.push(osc);
      return osc;
    }),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
  };

  return { ctx, oscillators };
}

describe('efek suara pilih acak', () => {
  const originalAudioContext = Object.getOwnPropertyDescriptor(window, 'AudioContext');

  afterEach(() => {
    resetSoundStateForTest();
    if (originalAudioContext) {
      Object.defineProperty(window, 'AudioContext', originalAudioContext);
    } else {
      delete (window as unknown as Record<string, unknown>).AudioContext;
    }
  });

  it('aktif secara default dan menyimpan status toggle ke storage', () => {
    const storage = createMemoryStorage();
    expect(isPickerSoundEnabled(storage)).toBe(true);
    expect(togglePickerSound(storage)).toBe(false);
    expect(isPickerSoundEnabled(storage)).toBe(false);
    expect(storage.getItem('nongki:picker-sound')).toBe('off');

    expect(setPickerSoundEnabled(true, storage)).toBe(true);
    expect(isPickerSoundEnabled(storage)).toBe(true);
    expect(storage.getItem('nongki:picker-sound')).toBe('on');
  });

  it('memainkan tick dan chime reveal saat aktif, lalu diam saat dimatikan', () => {
    const { ctx, oscillators } = createMockAudioContext();
    const AudioCtor = vi.fn(function mockAudio() {
      return ctx;
    });
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: AudioCtor });

    playPickerTick(3, 9);
    expect(oscillators).toHaveLength(1);
    expect(oscillators[0].type).toBe('triangle');

    oscillators[0].onended?.();
    expect(oscillators[0].disconnect).toHaveBeenCalledTimes(1);

    playPickerReveal();
    expect(oscillators).toHaveLength(4);
    expect(oscillators.slice(1).every((osc) => osc.type === 'sine')).toBe(true);

    setPickerSoundEnabled(false);
    playPickerTick(1, 9);
    playPickerReveal();
    expect(oscillators).toHaveLength(4);
  });

  it('aman saat AudioContext tidak didukung atau gagal dibuat', () => {
    delete (window as unknown as Record<string, unknown>).AudioContext;
    expect(() => playPickerTick(1, 5)).not.toThrow();
    expect(() => playPickerReveal()).not.toThrow();

    resetSoundStateForTest();
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: () => {
        throw new Error('blocked');
      },
    });
    expect(() => playPickerReveal()).not.toThrow();
  });
});
