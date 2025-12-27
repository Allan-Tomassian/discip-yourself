// src/logic/priorities.js
// Palier 9/10 — Moteur de priorité (sans UI)
// Règles:
// - Ce fichier NE MODIFIE JAMAIS le state (lecture/compute uniquement)
// - 1 seul objectif actif est retourné (même si le state est incohérent)
// - Compat: "abandoned" est traité comme "invalid"

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function normalizeStatus(st) {
  if (!st) return "queued";
  if (st === "queued" || st === "active" || st === "done" || st === "invalid") return st;
  if (st === "abandoned") return "invalid";
  return "queued";
}

function parseHHMM(hhmm) {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
  return { h, m: mm };
}

// JS: 0=Sun..6=Sat  -> app: 1=Mon..7=Sun
function jsDowFromApp(appDow) {
  // 1=Mon..7=Sun -> JS 1..6,0
  return appDow === 7 ? 0 : appDow;
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// returns Date | null
export function nextPlannedDate(schedule, now = new Date()) {
  if (!schedule || typeof schedule !== "object") return null;
  const daysOfWeek = Array.isArray(schedule.daysOfWeek) ? schedule.daysOfWeek : [];
  const timeSlots = Array.isArray(schedule.timeSlots) ? schedule.timeSlots : [];

  if (daysOfWeek.length === 0 || timeSlots.length === 0) return null;

  const candidates = [];
  const nowMs = now.getTime();
  const today = startOfDay(now);

  for (const appDow of daysOfWeek) {
    const jsDow = jsDowFromApp(appDow);
    for (const slot of timeSlots) {
      const hm = parseHHMM(slot);
      if (!hm) continue;

      // search within next 14 days (safe)
      for (let add = 0; add <= 14; add++) {
        const day = new Date(today);
        day.setDate(day.getDate() + add);
        if (day.getDay() !== jsDow) continue;

        const dt = new Date(day);
        dt.setHours(hm.h, hm.m, 0, 0);

        if (dt.getTime() >= nowMs) {
          candidates.push(dt);
          break; // earliest for this (dow,slot)
        }
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return candidates[0];
}

// deadline expected: "YYYY-MM-DD"
export function daysUntilDeadline(goal, now = new Date()) {
  const dl = goal?.deadline;
  if (!dl || typeof dl !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dl.trim());
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);

  const deadlineDate = new Date(y, mo, d, 23, 59, 59, 999);
  const diffMs = deadlineDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export function getGoals(data) {
  const raw = Array.isArray(data?.goals) ? data.goals : [];
  // IMPORTANT: return copies (no mutation of the state objects)
  return raw.map((g) => ({ ...g, status: normalizeStatus(g?.status) }));
}

export function getActiveGoal(data) {
  const goals = getGoals(data);
  const activeId = data?.ui?.activeGoalId || null;

  // 1) UI selection wins if not terminal
  if (activeId) {
    const g = goals.find((x) => x.id === activeId);
    if (g && g.status !== "done" && g.status !== "invalid") return g;
  }

  // 2) Fallback: if multiple actives exist, pick deterministically (order asc)
  const actives = goals.filter((g) => g.status === "active" && g.status !== "done" && g.status !== "invalid");
  if (actives.length === 0) return null;

  actives.sort((a, b) => {
    const ao = typeof a.order === "number" ? a.order : 9999;
    const bo = typeof b.order === "number" ? b.order : 9999;
    if (ao !== bo) return ao - bo;
    const at = String(a.title || a.name || a.label || a.id || "");
    const bt = String(b.title || b.name || b.label || b.id || "");
    return at.localeCompare(bt);
  });

  return actives[0];
}

export function getQueuedGoals(data) {
  return getGoals(data).filter((g) => g.status === "queued");
}

/**
 * Score comparable: higher = more important.
 * Components (optional):
 * - order (lower => higher)
 * - next planned session (sooner => higher)
 * - deadline (closer => higher)
 * - whyLink (0..1)
 * - impact (0..10)
 */
export function computeGoalPriorityScore(goal, now = new Date()) {
  if (!goal || typeof goal !== "object") return Number.NEGATIVE_INFINITY;

  const st = normalizeStatus(goal.status);

  // active goal is always top (handled separately, but kept here for completeness)
  if (st === "active") return Number.POSITIVE_INFINITY;
  if (st === "done" || st === "invalid") return Number.NEGATIVE_INFINITY;

  const order = typeof goal.order === "number" ? goal.order : 9999;

  const next = nextPlannedDate(goal.schedule, now);
  const minutesUntilNext = next
    ? Math.max(0, Math.round((next.getTime() - now.getTime()) / 60000))
    : 999999;

  const dDays = daysUntilDeadline(goal, now);
  // if no deadline => neutral
  const deadlineUrgency = dDays == null ? 0 : clamp(60 - dDays, -60, 60);

  const whyLink = clamp(Number(goal.whyLink || 0), 0, 1);
  const impact = clamp(Number(goal.impact || 0), 0, 10);

  // Score weights: explainable and stable
  const orderScore = -order * 1000; // lower order => higher score
  const nextScore = -minutesUntilNext; // sooner => higher score
  const deadlineScore = deadlineUrgency * 50;
  const whyScore = whyLink * 500;
  const impactScore = impact * 30;

  return orderScore + nextScore + deadlineScore + whyScore + impactScore;
}

export function rankQueuedGoals(data, now = new Date()) {
  const queued = getQueuedGoals(data);

  return queued
    .map((g) => {
      const next = nextPlannedDate(g.schedule, now);
      const dDays = daysUntilDeadline(g, now);
      return {
        goal: g,
        score: computeGoalPriorityScore(g, now),
        meta: {
          nextPlannedAt: next ? next.toISOString() : null,
          daysUntilDeadline: dDays,
        },
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      const ao = typeof a.goal.order === "number" ? a.goal.order : 9999;
      const bo = typeof b.goal.order === "number" ? b.goal.order : 9999;
      if (ao !== bo) return ao - bo;

      const at = String(a.goal.title || a.goal.name || a.goal.label || a.goal.id || "");
      const bt = String(b.goal.title || b.goal.name || b.goal.label || b.goal.id || "");
      return at.localeCompare(bt);
    });
}

/**
 * Main entry: provides everything Home.jsx needs.
 * NOTE: Does NOT enforce state. It only computes from it.
 */
export function computePriorities(data, now = new Date(), topN = 3) {
  const goals = getGoals(data);
  const uiActiveId = data?.ui?.activeGoalId || null;

  // Debug/meta: detect incoherences (no UI effect, just for dev)
  const activeMarked = goals.filter((g) => g.status === "active");
  const activeIds = activeMarked.map((g) => g?.id).filter(Boolean);
  const warningMultiActive = activeIds.length > 1;
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  if (warningMultiActive && isDev) {
    // eslint-disable-next-line no-console
    console.warn("[priorities] Multiple active goals detected:", activeIds);
  }
  const meta = {
    hasMultipleActive: warningMultiActive,
    warningMultiActive,
    activeIds,
    uiActiveId,
  };

  const activeGoal = getActiveGoal(data);
  const rankedQueued = rankQueuedGoals(data, now);
  const nextGoals = rankedQueued.slice(0, Math.max(0, topN)).map((x) => x.goal);

  return {
    activeGoal,
    nextGoals,
    rankedQueued,
    meta,
  };
}
