// Web Audio API Sound Effects Synthesizer for AI FunVerse V2
// Procedural sounds generated in real-time to avoid loading slow or missing mp3 assets.

let audioCtx: AudioContext | null = null;
let globalMuted = false;

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
};

export const setMuted = (muted: boolean) => {
  globalMuted = muted;
};

export const isMuted = () => globalMuted;

const getContext = (): AudioContext | null => {
  if (globalMuted) return null;
  if (!audioCtx) {
    // Lazy initialize on first interaction
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn("AudioContext not supported in this browser:", e);
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// Play a simple high-tech button click sound
export const playClick = () => {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.08);

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
};

// Play a laser sound for Neon drawing or ball hunting
export const playLaser = () => {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
};

// Play a quick pop sound for ball popping
export const playPop = () => {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
};

// Spell sound for Doctor Strange Portal or Invisible Cloak
export const playSpell = () => {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(200, now);
  osc1.frequency.linearRampToValueAtTime(800, now + 0.4);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(204, now);
  osc2.frequency.linearRampToValueAtTime(804, now + 0.4);

  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.4);
  osc2.stop(now + 0.4);
};

// Game over / Failure drone
export const playGameOver = () => {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.linearRampToValueAtTime(60, now + 0.8);

  gain.gain.setValueAtTime(0.15, now);
  gain.gain.linearRampToValueAtTime(0.001, now + 0.8);

  osc.start(now);
  osc.stop(now + 0.8);
};

// Short visual ticking noise for countdowns
export const playTick = (freq = 400) => {
  const ctx = getContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  gain.gain.setValueAtTime(0.05, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
};

// Play a triumphant visual game win melody
export const playVictory = () => {
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const playNote = (freq: number, startOffset: number, duration: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + startOffset);

    gain.gain.setValueAtTime(0.07, now + startOffset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration - 0.02);

    osc.start(now + startOffset);
    osc.stop(now + startOffset + duration);
  };

  // C major arpeggio upward
  playNote(261.63, 0.0, 0.15); // C4
  playNote(329.63, 0.12, 0.15); // E4
  playNote(392.00, 0.24, 0.15); // G4
  playNote(523.25, 0.36, 0.4);  // C5
};
