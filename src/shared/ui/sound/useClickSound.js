export const CLICK_SOUND_STORAGE_KEY = "ui.soundEnabled";

let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) audioContext = new Ctor();
  return audioContext;
}

export function isClickSoundEnabled() {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(CLICK_SOUND_STORAGE_KEY);
  return raw === "1" || raw === "true";
}

export function setClickSoundEnabled(value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLICK_SOUND_STORAGE_KEY, value ? "1" : "0");
}

export function playClickSound() {
  if (!isClickSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(128, now + 0.045);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.032, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  } catch {
    // Never break UI interactions on audio failures.
  }
}
