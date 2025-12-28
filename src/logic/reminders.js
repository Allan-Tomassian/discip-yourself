import { uid } from "../utils/helpers";

function parseTime(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, min };
}

function formatNowKey(now) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(
    now.getMinutes()
  )}`;
}

export function normalizeReminder(raw, index = 0) {
  const r = raw && typeof raw === "object" ? { ...raw } : {};
  if (!r.id) r.id = uid();
  r.enabled = typeof r.enabled === "boolean" ? r.enabled : true;
  r.time = typeof r.time === "string" ? r.time : "09:00";
  r.label = typeof r.label === "string" ? r.label : `Rappel ${index + 1}`;
  r.goalId = typeof r.goalId === "string" ? r.goalId : "";
  return r;
}

export function getDueReminders(state, now, lastFiredMap) {
  const reminders = Array.isArray(state?.reminders) ? state.reminders : [];
  if (!reminders.length) return [];
  const timeKey = formatNowKey(now);
  const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const due = [];

  for (const r of reminders) {
    if (!r || r.enabled === false) continue;
    const parsed = parseTime(r.time);
    if (!parsed) continue;
    if (`${String(parsed.h).padStart(2, "0")}:${String(parsed.min).padStart(2, "0")}` !== nowHM) continue;
    if (lastFiredMap && lastFiredMap[r.id] === timeKey) continue;
    due.push(r);
    if (lastFiredMap) lastFiredMap[r.id] = timeKey;
  }

  return due;
}

export function playReminderSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
    osc.onended = () => ctx.close();
  } catch {}
}

export function sendReminderNotification(reminder, goalTitle = "") {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const title = reminder?.label || "Rappel";
    const body = goalTitle ? `Objectif: ${goalTitle}` : "Ouvre l’app pour continuer.";
    // eslint-disable-next-line no-new
    new Notification(title, { body, silent: true });
  } catch {}
}

export function requestReminderPermission() {
  if (!("Notification" in window)) return Promise.resolve("unsupported");
  if (Notification.permission === "granted") return Promise.resolve("granted");
  return Notification.requestPermission();
}
