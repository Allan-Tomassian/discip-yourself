import { uid } from "../utils/helpers";
import { todayKey } from "../utils/dates";

export const ENABLE_WEB_NOTIFICATIONS = false;

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

function normalizeDays(days) {
  if (!Array.isArray(days) || days.length === 0) return [1, 2, 3, 4, 5, 6, 7];
  const cleaned = days
    .map((d) => Number(d))
    .filter((d) => Number.isFinite(d) && d >= 1 && d <= 7);
  return cleaned.length ? cleaned : [1, 2, 3, 4, 5, 6, 7];
}

function normalizeChannel(raw) {
  const ch = typeof raw === "string" ? raw.toUpperCase() : "";
  return ch === "NOTIFICATION" ? "NOTIFICATION" : "IN_APP";
}

export function normalizeReminder(raw, index = 0) {
  const r = raw && typeof raw === "object" ? { ...raw } : {};
  if (!r.id) r.id = uid();
  r.enabled = typeof r.enabled === "boolean" ? r.enabled : true;
  r.time = typeof r.time === "string" ? r.time : "09:00";
  r.label = typeof r.label === "string" ? r.label : `Rappel ${index + 1}`;
  r.goalId = typeof r.goalId === "string" ? r.goalId : "";
  r.days = normalizeDays(r.days);
  r.channel = normalizeChannel(r.channel);
  return r;
}

export function getDueReminders(state, now, lastFiredMap) {
  const reminders = Array.isArray(state?.reminders) ? state.reminders : [];
  if (!reminders.length) return [];
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const habits = Array.isArray(state?.habits) ? state.habits : [];
  const timeKey = formatNowKey(now);
  const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const jsDow = now.getDay(); // 0=Sun..6=Sat
  const appDow = jsDow === 0 ? 7 : jsDow;
  const due = [];
  const occurrencesByGoal = new Map();
  for (const occ of occurrences) {
    if (!occ || typeof occ.goalId !== "string") continue;
    const list = occurrencesByGoal.get(occ.goalId) || [];
    list.push(occ);
    occurrencesByGoal.set(occ.goalId, list);
  }
  const today = todayKey(now);

  for (const r of reminders) {
    if (!r || r.enabled === false) continue;
    const goalId = typeof r.goalId === "string" ? r.goalId : "";
    const goal = goalId ? goals.find((g) => g?.id === goalId) || null : null;
    const habit = !goal && goalId ? habits.find((h) => h?.id === goalId) || null : null;
    const target = goal || habit;
    const goalOccurrences = goalId ? occurrencesByGoal.get(goalId) || [] : [];
    const hasOccurrences = goalOccurrences.length > 0;

    if (hasOccurrences) {
      const dueOccurrence = goalOccurrences.some((occ) => {
        if (!occ || typeof occ.date !== "string" || typeof occ.start !== "string") return false;
        const status = occ.status || "planned";
        if (status === "done" || status === "skipped") return false;
        if (occ.date !== today) return false;
        return occ.start === nowHM;
      });
      if (!dueOccurrence) continue;
      if (lastFiredMap && lastFiredMap[r.id] === timeKey) continue;
      due.push(r);
      if (lastFiredMap) lastFiredMap[r.id] = timeKey;
      continue;
    }

    const schedule = target && typeof target.schedule === "object" ? target.schedule : null;
    const timeSlots = Array.isArray(schedule?.timeSlots) ? schedule.timeSlots : [];
    if (!timeSlots.length) continue;
    const days = Array.isArray(schedule?.daysOfWeek) && schedule.daysOfWeek.length ? schedule.daysOfWeek : null;
    if (days && !days.includes(appDow)) continue;
    const slotMatch = timeSlots.some((slot) => {
      const parsed = parseTime(slot);
      if (!parsed) return false;
      return `${String(parsed.h).padStart(2, "0")}:${String(parsed.min).padStart(2, "0")}` === nowHM;
    });
    if (!slotMatch) continue;
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

export function sendReminderNotification(reminder, targetTitle = "") {
  if (!ENABLE_WEB_NOTIFICATIONS) return;
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const title = reminder?.label || "Rappel";
    const body = targetTitle ? `Cible: ${targetTitle}` : "Ouvre l’app pour continuer.";
    // eslint-disable-next-line no-new
    new Notification(title, { body, silent: true });
  } catch {}
}

export async function requestReminderPermission() {
  if (!ENABLE_WEB_NOTIFICATIONS) return "disabled";
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  try {
    await navigator.serviceWorker.ready;
  } catch {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}
