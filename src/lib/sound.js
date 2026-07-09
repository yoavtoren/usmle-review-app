// Soft tactile audio — synthesized with WebAudio (no assets, works offline).
// Every interactive press gets a felt-tip tick via global delegation; success
// and milestone sounds are layered on top by the flows that earn them.
let ctx = null;
let master = null;
const KEY = "usmle-app:sound";

export function soundEnabled() {
  return localStorage.getItem(KEY) !== "0";
}
export function setSoundEnabled(on) {
  localStorage.setItem(KEY, on ? "1" : "0");
}

function ensureCtx() {
  if (!soundEnabled()) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 880, type = "sine", dur = 0.08, gain = 0.05, when = 0, glide = 0, attack = 0.004 }) {
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + glide), t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/* Barely-there press tick — felt hammer on wood */
export function playTick() {
  tone({ freq: 1850, type: "sine", dur: 0.045, gain: 0.032 });
  tone({ freq: 620, type: "triangle", dur: 0.05, gain: 0.018 });
}

/* Toggle / checkbox — warm pop with a tiny upward bend */
export function playPop() {
  tone({ freq: 540, type: "sine", dur: 0.09, gain: 0.05, glide: 170 });
  tone({ freq: 1620, type: "sine", dur: 0.05, gain: 0.018 });
}

/* "Got it" — soft two-note resolve (E5 → A5 with a sparkle) */
export function playSuccess() {
  tone({ freq: 659.3, dur: 0.16, gain: 0.05 });
  tone({ freq: 880.0, dur: 0.28, gain: 0.055, when: 0.09 });
  tone({ freq: 1318.5, dur: 0.22, gain: 0.018, when: 0.09 });
}

/* Milestone fanfare — gentle rising arpeggio with shimmer */
export function playAchieve() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => tone({ freq: f, dur: 0.3, gain: 0.05, when: i * 0.085 }));
  tone({ freq: 2093, dur: 0.5, gain: 0.013, when: 0.34 });
}

/* Global delegation: one listener, every button press ticks. Also serves as
   the user-gesture hook that unlocks the AudioContext on iOS. */
export function initSound() {
  const SEL = "button, a, [role='button'], input[type='checkbox'], input[type='radio'], select, .chip";
  document.addEventListener(
    "pointerdown",
    (e) => {
      const el = e.target instanceof Element ? e.target.closest(SEL) : null;
      if (!el || el.disabled || el.getAttribute?.("aria-disabled") === "true") {
        ensureCtx();
        return;
      }
      playTick();
    },
    { capture: true, passive: true }
  );
}
