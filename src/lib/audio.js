// ── Web Audio API — Completion Sounds (zero dependencies) ────────────────
// All sounds are synthesized programmatically. No file downloads needed.

let ctx = null;

function getCtx() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume context if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Play a satisfying "task complete" jingle.
 * Three ascending chimes — classic dopamine hit.
 */
export function playComplete() {
  try {
    const c = getCtx();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);

      osc.type = 'sine';
      osc.frequency.value = freq;

      const t = c.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch (e) {
    console.warn('[audio] playComplete error:', e);
  }
}

/**
 * Soft "tick" for timer updates.
 */
export function playTick() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.value = 880;

    const t = c.currentTime;
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.start(t);
    osc.stop(t + 0.06);
  } catch {}
}

/**
 * "Focus start" — low, grounding tone.
 */
export function playFocusStart() {
  try {
    const c = getCtx();
    const notes = [261.63, 329.63]; // C4, E4
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = c.currentTime + i * 0.1;
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.start(t);
      osc.stop(t + 0.65);
    });
  } catch {}
}

/**
 * "Break time" — gentle high tones.
 */
export function playBreak() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, c.currentTime); // C6
    osc.frequency.exponentialRampToValueAtTime(698.46, c.currentTime + 0.3); // F5
    gain.gain.setValueAtTime(0.2, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.5);
    osc.start();
    osc.stop(c.currentTime + 0.55);
  } catch {}
}

/**
 * "New task added" — quick positive chirp.
 */
export function playAdd() {
  try {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, c.currentTime);
    osc.frequency.linearRampToValueAtTime(660, c.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
    osc.start();
    osc.stop(c.currentTime + 0.22);
  } catch {}
}
