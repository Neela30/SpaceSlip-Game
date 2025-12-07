export const ensureAudioContext = (audioCtxRef) => {
  if (audioCtxRef.current) return audioCtxRef.current;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  audioCtxRef.current = new AudioContext();
  return audioCtxRef.current;
};

export const playTone = (audioCtxRef, frequency, duration = 120, volume = 0.08) => {
  const ctx = ensureAudioContext(audioCtxRef);
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = frequency;
  osc.type = 'sine';
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration / 1000);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration / 1000 + 0.05);
};

export const createSfx = (audioCtxRef) => ({
  click: () => playTone(audioCtxRef, 520, 90, 0.06),
  chime: () => {
    playTone(audioCtxRef, 880, 130, 0.08);
    setTimeout(() => playTone(audioCtxRef, 660, 120, 0.06), 20);
  },
  fail: () => playTone(audioCtxRef, 210, 240, 0.09)
});

export const vibrate = (ms = 120) => {
  if (navigator.vibrate) {
    navigator.vibrate(ms);
  }
};
