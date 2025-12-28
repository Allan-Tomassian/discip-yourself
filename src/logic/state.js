import { loadState, saveState } from "../utils/storage";
import { uid } from "../utils/helpers";
import { normalizeGoalsState } from "./goals";
import { normalizeReminder } from "./reminders";

export const THEME_PRESETS = ["aurora", "midnight", "sunset", "ocean", "forest"];

export const DEFAULT_CATEGORIES = [
  { id: "cat_sport", name: "Sport", color: "#7C3AED", wallpaper: "" },
  { id: "cat_work", name: "Travail", color: "#06B6D4", wallpaper: "" },
  { id: "cat_health", name: "Santé", color: "#22C55E", wallpaper: "" },
];

export const DEFAULT_BLOCKS = [
  { id: "block_why", type: "WHY", enabled: true },
  { id: "block_habits", type: "HABITS", enabled: true },
  { id: "block_goal", type: "GOAL", enabled: true },
];

// Demo mode (disabled by default).
export const DEMO_MODE = false;

function isDemoMode() {
  if (DEMO_MODE) return true;
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "1";
  } catch {
    return false;
  }
}

// -----------------------------
// V2 (data-only): goal planning
// -----------------------------
// NOTE: no UI is wired to this yet. This is a safe schema extension.
// schedule: user planning defined at goal creation (not at "start")
// status: queued | active | done | invalid
// order: global execution order (lower = higher priority)
// resetPolicy: what happens on abandon

export function createDefaultGoalSchedule() {
  return {
    timezone: "Europe/Paris",

    // Weekly defaults (user will later edit in UI)
    // 1 = Monday ... 7 = Sunday
    daysOfWeek: [1, 3, 5],
    timeSlots: ["08:30"], // HH:mm

    // Session / reminders (data-only for now)
    durationMinutes: 60,
    remindBeforeMinutes: 10,
    allowSnooze: true,
    snoozeMinutes: 10,
    remindersEnabled: false,
  };
}

export function normalizeResetPolicy(raw) {
  // Accept string or legacy object shape { mode }
  const v = typeof raw === "string" ? raw : raw?.mode;
  if (v === "reset" || v === "invalidate") return v;
  return "invalidate";
}

export function normalizeGoal(rawGoal, index = 0) {
  const g = rawGoal && typeof rawGoal === "object" ? { ...rawGoal } : {};

  if (!g.id) g.id = uid();
  if (!g.categoryId) g.categoryId = DEFAULT_CATEGORIES[0].id;
  if (!g.title) g.title = "Objectif";
  if (!g.cadence) g.cadence = "WEEKLY";
  if (typeof g.target !== "number") g.target = 1;

  // Optional but strongly recommended: deadline as ISO date (YYYY-MM-DD)
  // Empty string means "no deadline yet".
  if (typeof g.deadline !== "string") g.deadline = "";

  // Optional: link strength to main WHY (0..1). Used by priorities engine when available.
  if (typeof g.whyLink !== "number") g.whyLink = 0;

  // Optional: user-estimated value/impact (0..10). Used as tie-breaker when available.
  if (typeof g.impact !== "number") g.impact = 0;

  // V2 fields
  // status: queued | active | done | invalid
  if (!g.status) g.status = "queued";
  if (typeof g.order !== "number") g.order = index + 1;
  if (!g.schedule || typeof g.schedule !== "object") {
    g.schedule = createDefaultGoalSchedule();
  } else {
    // Merge with defaults to be resilient to future schema changes.
    g.schedule = { ...createDefaultGoalSchedule(), ...g.schedule };

    if (!Array.isArray(g.schedule.daysOfWeek)) g.schedule.daysOfWeek = createDefaultGoalSchedule().daysOfWeek;
    if (!Array.isArray(g.schedule.timeSlots)) g.schedule.timeSlots = createDefaultGoalSchedule().timeSlots;
    if (typeof g.schedule.timezone !== "string") g.schedule.timezone = createDefaultGoalSchedule().timezone;

    if (typeof g.schedule.durationMinutes !== "number") g.schedule.durationMinutes = createDefaultGoalSchedule().durationMinutes;
    if (typeof g.schedule.remindBeforeMinutes !== "number") g.schedule.remindBeforeMinutes = createDefaultGoalSchedule().remindBeforeMinutes;
    if (typeof g.schedule.allowSnooze !== "boolean") g.schedule.allowSnooze = createDefaultGoalSchedule().allowSnooze;
    if (typeof g.schedule.snoozeMinutes !== "number") g.schedule.snoozeMinutes = createDefaultGoalSchedule().snoozeMinutes;
    if (typeof g.schedule.remindersEnabled !== "boolean") g.schedule.remindersEnabled = createDefaultGoalSchedule().remindersEnabled;
  }
  g.resetPolicy = normalizeResetPolicy(g.resetPolicy);

  return g;
}

export function initialData() {
  return {
    profile: {
      name: "",
      whyText: "",
      whyImage: "",
      xp: 0,
      level: 1,
      rewardClaims: {},
    },
    ui: {
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: null,
      // V2: per-page theming
      pageThemes: { home: "aurora" },
      pageAccents: { home: "#7C3AED" },

      // legacy (kept for backward compatibility during migration)
      pageThemeHome: "aurora",
      accentHome: "#7C3AED",

      // V2: one active goal at a time
      activeGoalId: null,
      mainGoalId: null,
    },
    categories: [],
    goals: [],
    habits: [],
    reminders: [],
    checks: {},
  };
}

export function demoData() {
  const categories = [
    { id: "demo_cat_1", name: "Catégorie 1", color: "#7C3AED", wallpaper: "" },
    { id: "demo_cat_2", name: "Catégorie 2", color: "#06B6D4", wallpaper: "" },
    { id: "demo_cat_3", name: "Catégorie 3", color: "#22C55E", wallpaper: "" },
  ];

  return {
    profile: {
      name: "Démo",
      whyText: "Exemple de pourquoi (démo).",
      whyImage: "",
      xp: 0,
      level: 1,
      rewardClaims: {},
    },
    ui: {
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: categories[0].id,
      pageThemes: { home: "aurora" },
      pageAccents: { home: "#7C3AED" },
      pageThemeHome: "aurora",
      accentHome: "#7C3AED",
      activeGoalId: null,
      mainGoalId: null,
    },
    categories: categories.map((c) => ({ ...c })),
    goals: [
      { id: uid(), categoryId: categories[0].id, title: "Objectif A", cadence: "WEEKLY", target: 2 },
      { id: uid(), categoryId: categories[1].id, title: "Objectif B", cadence: "DAILY", target: 1 },
    ],
    habits: [
      { id: uid(), categoryId: categories[0].id, title: "Habitude 1", cadence: "WEEKLY", target: 2 },
      { id: uid(), categoryId: categories[1].id, title: "Habitude 2", cadence: "DAILY", target: 1 },
    ],
    reminders: [],
    checks: {},
  };
}

export function migrate(prev) {
  const next = prev && typeof prev === "object" ? { ...prev } : initialData();

  // profile
  if (!next.profile) next.profile = {};
  if (typeof next.profile.xp !== "number") next.profile.xp = 0;
  if (typeof next.profile.level !== "number") next.profile.level = 1;
  if (!next.profile.rewardClaims || typeof next.profile.rewardClaims !== "object") next.profile.rewardClaims = {};

  // ui
  if (!next.ui) next.ui = {};
  if (!Array.isArray(next.ui.blocks) || next.ui.blocks.length === 0) next.ui.blocks = DEFAULT_BLOCKS.map((b) => ({ ...b }));
  if (!next.ui.selectedCategoryId) {
    next.ui.selectedCategoryId = Array.isArray(next.categories) && next.categories.length ? next.categories[0].id : null;
  }

  // V2: ensure pageThemes/pageAccents exist (used by utils/_theme)
  if (!next.ui.pageThemes || typeof next.ui.pageThemes !== "object") next.ui.pageThemes = {};
  if (!next.ui.pageAccents || typeof next.ui.pageAccents !== "object") next.ui.pageAccents = {};

  // migrate legacy single-value keys into the V2 objects
  if (!next.ui.pageThemes.home) {
    if (next.ui.pageThemeHome) next.ui.pageThemes.home = next.ui.pageThemeHome;
    else next.ui.pageThemes.home = "aurora";
  }
  if (!next.ui.pageAccents.home) {
    if (next.ui.accentHome) next.ui.pageAccents.home = next.ui.accentHome;
    else next.ui.pageAccents.home = "#7C3AED";
  }

  // legacy defaults (kept so old code paths don't crash)
  if (!next.ui.pageThemeHome) next.ui.pageThemeHome = next.ui.pageThemes?.home || "aurora";
  if (!next.ui.accentHome) next.ui.accentHome = next.ui.pageAccents?.home || "#7C3AED";

  if (typeof next.ui.activeGoalId === "undefined") next.ui.activeGoalId = null;
  if (typeof next.ui.mainGoalId === "undefined") next.ui.mainGoalId = null;

  // categories
  if (!Array.isArray(next.categories)) next.categories = [];

  // goals (V2 normalize)
  if (!Array.isArray(next.goals)) next.goals = [];
  next.goals = next.goals.map((g, i) => normalizeGoal(g, i));
  next.goals = next.goals.map((g) => ({
    ...g,
    status: g.status === "abandoned" ? "invalid" : g.status,
  }));

  // habits/checks
  if (!Array.isArray(next.habits)) next.habits = [];
  if (!Array.isArray(next.reminders)) next.reminders = [];
  next.reminders = next.reminders.map((r, i) => normalizeReminder(r, i));
  if (!next.checks || typeof next.checks !== "object") next.checks = {};

  return normalizeGoalsState(next);
}

export function usePersistedState(React) {
  const { useEffect, useState } = React;
  const demoMode = isDemoMode();
  const [data, setData] = useState(() => {
    if (demoMode) return migrate(demoData());
    return migrate(loadState() || initialData());
  });
  useEffect(() => {
    if (demoMode) return;
    saveState(data);
  }, [data, demoMode]);
  return [data, setData];
}
