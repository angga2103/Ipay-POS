/**
 * Web Audio API Sound Synthesizer for POS Cashier Operations
 * Works 100% offline with zero external audio assets or network latency.
 */

let audioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

export const isSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem('pos_sound_enabled');
  return val !== 'false';
};

export const toggleSound = (enabled?: boolean): boolean => {
  const current = isSoundEnabled();
  const next = enabled !== undefined ? enabled : !current;
  localStorage.setItem('pos_sound_enabled', String(next));
  return next;
};

/**
 * High-pitch scanner beep on successful barcode scan or item add
 */
export const playScanBeep = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1760, ctx.currentTime); // A6 note (crisp POS scanner beep)
    
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    console.debug('Audio playback error:', e);
  }
};

/**
 * Dual-tone pleasant chime on successful payment completion
 */
export const playSuccessChime = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 arpeggio bell

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.25, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.35);
    });
  } catch (e) {
    console.debug('Audio playback error:', e);
  }
};

/**
 * Low double-boop warning on invalid barcode, out of stock, or validation error
 */
export const playErrorBoop = (): void => {
  if (!isSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now + offset);

      gain.gain.setValueAtTime(0.2, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.01, now + offset + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  } catch (e) {
    console.debug('Audio playback error:', e);
  }
};
