import { uid } from "../utils/helpers";
import { toLocalDateKey } from "../utils/dateKey";
import { resolveGoalType } from "../domain/goalType";

export const ENABLE_WEB_NOTIFICATIONS = false;

// Single source of truth for due window.
export const DUE_SOON_MINUTES = 15;
const COOLDOWN_MS = 60_000;

function parseTimeToMinutes(value) {
  if (typeof value !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function minutesSinceMidnight(now) {
  return now.getHours() * 60 + now.getMinutes();
}

function minutesToTime(minutes) {
  if (!Number.isFinite(minutes)) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 0 || h > 23 || m < 0 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isOccurrenceDueSoon(occ, nowMinutes, windowMinutes) {
  if (!occ || typeof occ.start !== "string") return false;
  const occMinutes = parseTimeToMinutes(occ.start);
  if (!Number.isFinite(occMinutes)) return false;
  const delta = occMinutes - nowMinutes;
  return delta >= 0 && delta <= windowMinutes;
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
  const occurrences = Array.isArray(state?.occurrences) ? state.occurrences : [];
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const nowMinutes = minutesSinceMidnight(now);
  const today = toLocalDateKey(now);
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  const debug = isDev && typeof window !== "undefined" && window.__debugReminders;
  const due = [];
  const firedGoals = new Set();
  const candidates = debug ? [] : null;
  const goalsById = new Map(goals.map((g) => [g?.id, g]));

  const remindersByGoal = new Map();
  for (const r of reminders) {
    if (!r || r.enabled === false) continue;
    const goalId = typeof r.goalId === "string" ? r.goalId : "";
    if (!goalId) continue;
    const goal = goalsById.get(goalId);
    if (!goal || resolveGoalType(goal) !== "PROCESS") continue;
    const list = remindersByGoal.get(goalId) || [];
    list.push(r);
    remindersByGoal.set(goalId, list);
  }

  const dueByGoal = new Map();
  for (const occ of occurrences) {
    if (!occ || typeof occ.goalId !== "string") continue;
    if (occ.date !== today) continue;
    if (occ.status !== "planned") continue;
    if (!isOccurrenceDueSoon(occ, nowMinutes, DUE_SOON_MINUTES)) continue;
    const occMinutes = parseTimeToMinutes(occ.start);
    if (!Number.isFinite(occMinutes)) continue;
    const normalizedStart = minutesToTime(occMinutes);
    if (!normalizedStart) continue;
    const existing = dueByGoal.get(occ.goalId);
    if (!existing || occMinutes < existing.minutes) {
      dueByGoal.set(occ.goalId, { minutes: occMinutes, start: normalizedStart });
    }
  }
  if (!dueByGoal.size) return [];

  function shouldSkipFire(goalId, dueStart) {
    const key = `${goalId}::${today}::${dueStart}`;
    if (!lastFiredMap) return false;
    const last = lastFiredMap[key];
    if (last === true) return true;
    if (Number.isFinite(last) && now.getTime() - last < COOLDOWN_MS) return true;
    lastFiredMap[key] = now.getTime();
    return false;
  }

  for (const [goalId, reminderItems] of remindersByGoal.entries()) {
    const dueInfo = dueByGoal.get(goalId);
    if (!dueInfo) {
      if (candidates) candidates.push({ goalId, source: "occurrence", due: false });
      continue;
    }
    if (shouldSkipFire(goalId, dueInfo.start)) {
      if (candidates) candidates.push({ goalId, source: "occurrence", time: dueInfo.start, skipped: "fired" });
      continue;
    }
    if (firedGoals.has(goalId)) {
      if (candidates) candidates.push({ goalId, source: "occurrence", time: dueInfo.start, skipped: "duplicate" });
      continue;
    }
    const template = reminderItems[0] || {};
    const reminder = {
      id: template.id || `${goalId}-${today}-${dueInfo.start}-occ`,
      goalId,
      time: dueInfo.start,
      enabled: true,
      channel: template.channel || "IN_APP",
      label: template.label || "Rappel",
      days: template.days || normalizeDays([]),
      __source: "occurrence",
    };
    if (candidates) candidates.push({ goalId, source: "occurrence", time: dueInfo.start, due: true });
    due.push(reminder);
    firedGoals.add(goalId);
  }

  due.sort((a, b) => {
    const aMin = parseTimeToMinutes(a.time) ?? 0;
    const bMin = parseTimeToMinutes(b.time) ?? 0;
    return aMin - bMin;
  });

  if (debug) {
    // eslint-disable-next-line no-console
    console.debug("[reminders] candidates", { today, candidates });
    // eslint-disable-next-line no-console
    console.debug("[reminders] due", { count: due.length, due: due.map((r) => ({ goalId: r.goalId, source: r.__source, time: r.time })) });
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
  } catch (err) {
    void err;
  }
}

export function internalTestReminders() {
  const isProd = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD;
  if (isProd) return;

  const now = new Date(2026, 0, 18, 9, 50, 0);
  const today = toLocalDateKey(now);
  const baseGoal = { id: "g1", type: "PROCESS", planType: "ACTION" };
  const baseReminder = { id: "r1", goalId: "g1", enabled: true, channel: "IN_APP", label: "Rappel" };
  const baseState = { goals: [baseGoal], reminders: [baseReminder], occurrences: [] };

  const withPlanned = {
    ...baseState,
    occurrences: [{ id: "o1", goalId: "g1", date: today, start: "10:00", status: "planned" }],
  };
  console.assert(getDueReminders(withPlanned, now, {}).length === 1, "reminders: planned due soon");

  const firedMap = {};
  getDueReminders(withPlanned, now, firedMap);
  console.assert(getDueReminders(withPlanned, now, firedMap).length === 0, "reminders: cooldown");

  const dup = {
    ...baseState,
    occurrences: [
      { id: "o1", goalId: "g1", date: today, start: "10:00", status: "planned" },
      { id: "o2", goalId: "g1", date: today, start: "10:00", status: "planned" },
    ],
  };
  console.assert(getDueReminders(dup, now, {}).length === 1, "reminders: duplicate occurrences");

  const dupReminders = {
    ...baseState,
    reminders: [
      { ...baseReminder, id: "r1" },
      { ...baseReminder, id: "r2" },
    ],
    occurrences: [{ id: "o1", goalId: "g1", date: today, start: "10:00", status: "planned" }],
  };
  console.assert(getDueReminders(dupReminders, now, {}).length === 1, "reminders: duplicate reminders");

  const past = {
    ...baseState,
    occurrences: [{ id: "o1", goalId: "g1", date: today, start: "09:49", status: "planned" }],
  };
  console.assert(getDueReminders(past, now, {}).length === 0, "reminders: past occurrence");

  const done = {
    ...baseState,
    occurrences: [{ id: "o1", goalId: "g1", date: today, start: "10:00", status: "done" }],
  };
  console.assert(getDueReminders(done, now, {}).length === 0, "reminders: done skipped");

  const tomorrow = {
    ...baseState,
    occurrences: [{ id: "o1", goalId: "g1", date: "2099-01-01", start: "10:00", status: "planned" }],
  };
  console.assert(getDueReminders(tomorrow, now, {}).length === 0, "reminders: not today");

  const nowShort = new Date(2026, 0, 18, 8, 50, 0);
  const shortStart = {
    ...baseState,
    occurrences: [{ id: "o1", goalId: "g1", date: today, start: "9:00", status: "planned" }],
  };
  console.assert(getDueReminders(shortStart, nowShort, {}).length === 1, "reminders: short start parsed");
  const normalizedKey = `g1::${today}::09:00`;
  const firedShort = { [normalizedKey]: nowShort.getTime() };
  console.assert(getDueReminders(shortStart, nowShort, firedShort).length === 0, "reminders: key normalized");
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
  } catch (err) {
    void err;
  }
}

export async function requestReminderPermission() {
  if (!ENABLE_WEB_NOTIFICATIONS) return "disabled";
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) return "unsupported";
  if (!("serviceWorker" in navigator)) return "unsupported";
  try {
    await navigator.serviceWorker.ready;
  } catch (err) {
    void err;
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}
