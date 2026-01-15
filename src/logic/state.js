// src/logic/state.js
import { loadState, saveState } from "../utils/storage";
import { uid } from "../utils/helpers";
import { normalizeGoalsState } from "./goals";
import { normalizeReminder } from "./reminders";
import { normalizeSession } from "./sessions";
import { BLOCKS_SCHEMA_VERSION, getDefaultBlocksByPage } from "./blocks/registry";
import { ensureBlocksConfig } from "./blocks/ensureBlocksConfig";
import { validateBlocksState } from "./blocks/validateBlocksState";

export const THEME_PRESETS = ["aurora", "midnight", "sunset", "ocean", "forest"];

function toLocalDateKey(d = new Date()) {
  const dateObj = d instanceof Date && !Number.isNaN(d.getTime()) ? d : new Date();
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DEFAULT_CATEGORIES = [
  { id: "cat_sport", name: "Sport", color: "#7C3AED", wallpaper: "", mainGoalId: null },
  { id: "cat_work", name: "Travail", color: "#06B6D4", wallpaper: "", mainGoalId: null },
  { id: "cat_health", name: "Santé", color: "#22C55E", wallpaper: "", mainGoalId: null },
];

export const DEFAULT_BLOCKS = [
  { id: "block_why", type: "WHY", enabled: true },
  { id: "block_habits", type: "HABITS", enabled: true },
  { id: "block_goal", type: "GOAL", enabled: true },
];

const MEASURE_TYPES = new Set(["money", "counter", "time", "energy", "distance", "weight"]);
const GOAL_PRIORITY_VALUES = new Set(["prioritaire", "secondaire", "bonus"]);

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
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    timeSlots: ["09:00"], // HH:mm

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

function normalizeCadence(raw) {
  const v = typeof raw === "string" ? raw.toUpperCase() : "";
  if (v === "DAILY" || v === "WEEKLY" || v === "YEARLY") return v;
  return "";
}

function normalizeGoalPriority(raw) {
  const v = typeof raw === "string" ? raw.toLowerCase() : "";
  return GOAL_PRIORITY_VALUES.has(v) ? v : "";
}

function cadenceToFreqUnit(cadence) {
  if (cadence === "DAILY") return "DAY";
  if (cadence === "YEARLY") return "YEAR";
  return "WEEK";
}

function inferMeasureTypeFromUnit(unit) {
  const raw = typeof unit === "string" ? unit.trim().toLowerCase() : "";
  if (!raw) return "";
  if (raw === "€" || raw === "eur" || raw === "euro" || raw === "euros") return "money";
  if (raw === "kg" || raw === "kilo" || raw === "kilos") return "weight";
  if (raw === "km" || raw === "kilometre") return "distance";
  if (raw === "min" || raw === "minute" || raw === "minutes" || raw === "h" || raw === "heure" || raw === "heures")
    return "time";
  if (raw === "pas" || raw === "step" || raw === "steps" || raw === "rep" || raw === "reps") return "counter";
  if (raw === "pt" || raw === "pts" || raw === "point" || raw === "points") return "energy";
  if (raw === "%") return "counter";
  if (MEASURE_TYPES.has(raw)) return raw;
  return "";
}

function backfillGoalLegacyFields(rawGoal) {
  if (!rawGoal || typeof rawGoal !== "object") return rawGoal;
  const g = { ...rawGoal };
  const rawKind = typeof g.kind === "string" ? g.kind.toUpperCase() : "";
  const rawType = typeof g.type === "string" ? g.type.toUpperCase() : "";
  const rawPlan = typeof g.planType === "string" ? g.planType.toUpperCase() : "";

  if (!rawType) {
    if (rawKind === "OUTCOME") g.type = "OUTCOME";
    else if (rawKind === "ACTION") g.type = "PROCESS";
    else if (rawPlan === "STATE") g.type = "OUTCOME";
    else if (rawPlan === "ACTION" || rawPlan === "ONE_OFF") g.type = "PROCESS";
  }

  if (!rawPlan) {
    if (g.type === "OUTCOME") g.planType = "STATE";
    else if (g.type === "PROCESS") g.planType = g.oneOffDate ? "ONE_OFF" : "ACTION";
  }

  if (!g.freqUnit || !Number.isFinite(g.freqCount)) {
    const cadence = normalizeCadence(g.cadence);
    if (!g.freqUnit && cadence) g.freqUnit = cadenceToFreqUnit(cadence);
    if (!Number.isFinite(g.freqCount)) {
      const rawTarget = typeof g.target === "string" ? Number(g.target) : g.target;
      const target = Number.isFinite(rawTarget) && rawTarget > 0 ? Math.floor(rawTarget) : 1;
      g.freqCount = target;
    }
  }

  if (!g.startAt && typeof g.startDate === "string" && g.startDate.trim()) {
    g.startAt = `${g.startDate.trim()}T09:00`;
  }

  if (!g.parentId && typeof g.primaryGoalId === "string" && g.primaryGoalId.trim()) {
    g.parentId = g.primaryGoalId.trim();
  }
  if (!Number.isFinite(g.weight) && Number.isFinite(g.linkWeight)) {
    g.weight = g.linkWeight;
  }

  if (g.metric && typeof g.metric === "object") {
    if (!g.measureType) {
      const inferred = inferMeasureTypeFromUnit(g.metric.unit);
      if (inferred) g.measureType = inferred;
    }
    if (!Number.isFinite(g.targetValue) && Number.isFinite(g.metric.targetValue)) {
      g.targetValue = g.metric.targetValue;
    }
    if (!Number.isFinite(g.currentValue) && Number.isFinite(g.metric.currentValue)) {
      g.currentValue = g.metric.currentValue;
    }
  }

  if (!normalizeGoalPriority(g.priority)) {
    const level = typeof g.priorityLevel === "string" ? g.priorityLevel.toLowerCase() : "";
    if (level === "primary") g.priority = "prioritaire";
    else if (level === "secondary") g.priority = "secondaire";
    else {
      const tier = typeof g.priorityTier === "string" ? g.priorityTier.toLowerCase() : "";
      if (tier === "essential") g.priority = "prioritaire";
      else if (tier === "optional" || tier === "someday") g.priority = "bonus";
      else g.priority = "secondaire";
    }
  }

  return g;
}

function normalizeLegacyHabit(rawHabit, index = 0) {
  const h = rawHabit && typeof rawHabit === "object" ? { ...rawHabit } : {};
  if (!h.id) h.id = uid();
  if (typeof h.title !== "string" || !h.title.trim()) {
    if (typeof h.name === "string" && h.name.trim()) h.title = h.name.trim();
    else h.title = `Action ${index + 1}`;
  }
  if (typeof h.cadence !== "string") h.cadence = "WEEKLY";
  if (!Number.isFinite(h.target)) h.target = 1;
  if (typeof h.categoryId !== "string") h.categoryId = "";
  return h;
}

function resolveGoalTypeLegacy(goal) {
  const raw = (goal?.type || goal?.planType || goal?.kind || "").toString().toUpperCase();
  if (raw === "OUTCOME" || raw === "PROCESS") return raw;
  if (raw === "STATE") return "OUTCOME";
  if (raw === "ACTION" || raw === "ONE_OFF") return "PROCESS";
  if (goal?.metric && typeof goal.metric === "object") return "OUTCOME";
  return "";
}

function mergeLegacyHabitsIntoGoals(state) {
  if (!state || typeof state !== "object") return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const habits = Array.isArray(state.habits) ? state.habits : [];
  if (!habits.length) return state;

  const existingGoalIds = new Set(goals.map((g) => g?.id).filter(Boolean));
  const existingProcessIds = new Set(
    goals.filter((g) => resolveGoalTypeLegacy(g) === "PROCESS").map((g) => g?.id).filter(Boolean)
  );

  const categories = Array.isArray(state.categories) ? state.categories : [];
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const goalsById = new Map(goals.map((g) => [g.id, g]));

  const additions = [];
  for (const habit of habits) {
    if (!habit || !habit.id) continue;
    if (existingProcessIds.has(habit.id)) continue;
    if (existingGoalIds.has(habit.id)) continue;

    const cadence = normalizeCadence(habit.cadence);
    const freqUnit = cadence ? cadenceToFreqUnit(cadence) : "WEEK";
    const rawTarget = typeof habit.target === "string" ? Number(habit.target) : habit.target;
    const freqCount = Number.isFinite(rawTarget) && rawTarget > 0 ? Math.floor(rawTarget) : 1;
    const categoryId = typeof habit.categoryId === "string" ? habit.categoryId : "";
    const category = categoryId ? categoryById.get(categoryId) : null;

    let parentId = null;
    if (typeof habit.parentId === "string" && habit.parentId.trim()) parentId = habit.parentId.trim();
    if (!parentId && typeof habit.primaryGoalId === "string" && habit.primaryGoalId.trim()) {
      parentId = habit.primaryGoalId.trim();
    }
    if (!parentId && category?.mainGoalId) parentId = category.mainGoalId;
    if (parentId && goalsById.has(parentId)) {
      const parent = goalsById.get(parentId);
      if (resolveGoalTypeLegacy(parent) !== "OUTCOME" || parent?.categoryId !== categoryId) parentId = null;
    }

    additions.push({
      id: habit.id,
      categoryId,
      title: habit.title || "Action",
      type: "PROCESS",
      planType: "ACTION",
      kind: "ACTION",
      cadence: cadence || "WEEKLY",
      target: freqCount,
      freqUnit,
      freqCount,
      parentId,
      primaryGoalId: parentId,
    });
  }

  if (!additions.length) return state;
  return { ...state, goals: [...goals, ...additions] };
}

export function normalizeCategory(rawCat, index = 0) {
  const c = rawCat && typeof rawCat === "object" ? { ...rawCat } : {};
  if (!c.id) c.id = uid();
  if (typeof c.name !== "string" || !c.name.trim()) c.name = `Catégorie ${index + 1}`;
  if (typeof c.color !== "string" || !c.color.trim()) c.color = "#7C3AED";
  if (typeof c.wallpaper !== "string") c.wallpaper = "";
  if (typeof c.whyText !== "string") c.whyText = "";
  if (typeof c.templateId !== "string" || !c.templateId.trim()) c.templateId = null;
  c.mainGoalId = typeof c.mainGoalId === "string" && c.mainGoalId.trim() ? c.mainGoalId : null;
  return c;
}

export function normalizeGoal(rawGoal, index = 0, categories = []) {
  const g = rawGoal && typeof rawGoal === "object" ? { ...rawGoal } : {};

  if (!g.id) g.id = uid();
  const fallbackCategoryId = Array.isArray(categories) && categories.length ? categories[0].id : null;
  if (typeof g.categoryId !== "string" || !g.categoryId.trim()) {
    if (fallbackCategoryId) g.categoryId = fallbackCategoryId;
  }

  const rawType = (g.type || g.planType || g.kind || "").toString().toUpperCase();
  const hasMetric = g.metric && typeof g.metric === "object";
  const isOutcome = rawType === "OUTCOME" || rawType === "STATE" || hasMetric;
  const isProcess = rawType === "PROCESS" || rawType === "ACTION" || rawType === "ONE_OFF";

  const inferredPlanType = rawType === "ONE_OFF" ? "ONE_OFF" : isProcess ? "ACTION" : "STATE";

  // Canonical semantics:
  // - OUTCOME = objective (STATE) : can carry metric/deadline/notes, but never scheduling/frequency/session/parent.
  // - PROCESS = habit (ACTION or ONE_OFF) : can carry frequency/session/oneOffDate, but never metric/deadline/notes.
  if (isOutcome) {
    g.type = "OUTCOME";
    g.planType = "STATE";
    g.kind = "OUTCOME";
  } else if (isProcess) {
    g.type = "PROCESS";
    g.planType = inferredPlanType;
    g.kind = "ACTION";
  }

  if (!g.title) g.title = "Objectif";
  if (!isOutcome) {
    if (!g.cadence) g.cadence = "WEEKLY";
    if (typeof g.target !== "number") g.target = 1;
  }

  if (typeof g.templateId !== "string") g.templateId = null;
  if (isOutcome) g.templateType = "GOAL";
  else if (isProcess) g.templateType = "HABIT";
  else if (typeof g.templateType !== "string") g.templateType = null;

  // Optional: deadline as ISO date (YYYY-MM-DD). Empty string means "no deadline yet".
  if (typeof g.deadline !== "string") g.deadline = "";
  if (typeof g.notes !== "string") g.notes = "";

  // Optional: measurement fields for OUTCOME goals.
  const rawMeasure = typeof g.measureType === "string" ? g.measureType.trim() : "";
  g.measureType = MEASURE_TYPES.has(rawMeasure) ? rawMeasure : null;
  const rawTarget = typeof g.targetValue === "string" ? Number(g.targetValue) : g.targetValue;
  const rawCurrent = typeof g.currentValue === "string" ? Number(g.currentValue) : g.currentValue;
  g.targetValue = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : null;
  g.currentValue = Number.isFinite(rawCurrent) && rawCurrent >= 0 ? rawCurrent : null;
  if (!g.targetValue) g.currentValue = null;

  // Strict separation:
  // OUTCOME (objective): keep metric/deadline/notes, but remove any habit/scheduling fields.
  // PROCESS (habit): keep planning/frequency fields, but remove any outcome fields.
  if (isOutcome) {
    // Remove habit fields
    g.cadence = undefined;
    g.target = undefined;
    g.freqUnit = undefined;
    g.freqCount = undefined;
    g.sessionMinutes = null;
    g.oneOffDate = undefined;

    // Remove scheduling remnants
    g.startAt = null;
    g.endAt = null;
    g.startDate = undefined;

    // Outcome is the parent, never a child
    g.parentId = null;
    g.primaryGoalId = null;
    g.weight = 0;
    g.linkWeight = 0;

    if (!g.measureType) {
      g.targetValue = null;
      g.currentValue = null;
    }
  }

  if (isProcess) {
    // Remove outcome fields
    g.deadline = "";
    g.metric = null;
    g.notes = "";
    g.measureType = null;
    g.targetValue = null;
    g.currentValue = null;

    // Ensure planType coherence
    if (g.planType === "ONE_OFF") {
      // oneOffDate is the only date carrier for ONE_OFF habits
      if (typeof g.oneOffDate !== "string" || !g.oneOffDate.trim()) {
        // allow legacy fallback if any
        const legacy = typeof rawGoal?.deadline === "string" ? rawGoal.deadline.trim() : "";
        g.oneOffDate = legacy || "";
      }
      g.cadence = undefined;
      g.target = undefined;
      g.freqUnit = undefined;
      g.freqCount = undefined;
      g.sessionMinutes = null;
    } else {
      // ACTION habit must not carry oneOffDate
      g.oneOffDate = undefined;
    }
  }

  // If a PROCESS has no valid parentId, keep it null (linking is optional)
  if (isProcess) {
    const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
    g.parentId = rawParent ? rawParent : null;
    if (typeof g.primaryGoalId === "string") {
      const rawPrimary = g.primaryGoalId.trim();
      g.primaryGoalId = rawPrimary ? rawPrimary : null;
    }
    if (!g.parentId) g.weight = Number.isFinite(g.weight) ? g.weight : 100;
  }

  // Optional: link strength to main WHY (0..1). Used by priorities engine when available.
  if (typeof g.whyLink !== "number") g.whyLink = 0;

  // Optional: user-estimated value/impact (0..10). Used as tie-breaker when available.
  if (typeof g.impact !== "number") g.impact = 0;

  // V2 fields
  // status: queued | active | done | invalid
  if (!g.status) g.status = "queued";
  if (typeof g.order !== "number") g.order = index + 1;
    // Scheduling rules:
  // - PROCESS/ACTION: schedule is canonical and can later drive occurrences/reminders.
  // - OUTCOME/STATE: schedule is OPTIONAL and is only used for planning visibility (calendar coloring),
  //   reminders must stay disabled for OUTCOME.
  const shouldHaveProcessSchedule = isProcess && g.planType === "ACTION";
  const shouldKeepOutcomeSchedule = isOutcome && g.planType === "STATE" && g.schedule && typeof g.schedule === "object";

  if (shouldHaveProcessSchedule || shouldKeepOutcomeSchedule) {
    const base = createDefaultGoalSchedule();
    if (!g.schedule || typeof g.schedule !== "object") {
      g.schedule = { ...base };
    } else {
      g.schedule = { ...base, ...g.schedule };
    }

    if (!Array.isArray(g.schedule.daysOfWeek)) g.schedule.daysOfWeek = base.daysOfWeek;
    if (!Array.isArray(g.schedule.timeSlots)) g.schedule.timeSlots = base.timeSlots;
    if (typeof g.schedule.timezone !== "string") g.schedule.timezone = base.timezone;

    if (typeof g.schedule.durationMinutes !== "number") g.schedule.durationMinutes = base.durationMinutes;
    if (typeof g.schedule.remindBeforeMinutes !== "number") g.schedule.remindBeforeMinutes = base.remindBeforeMinutes;
    if (typeof g.schedule.allowSnooze !== "boolean") g.schedule.allowSnooze = base.allowSnooze;
    if (typeof g.schedule.snoozeMinutes !== "number") g.schedule.snoozeMinutes = base.snoozeMinutes;
    if (typeof g.schedule.remindersEnabled !== "boolean") g.schedule.remindersEnabled = base.remindersEnabled;

    // Hard rule: OUTCOME goals never emit reminders.
    if (isOutcome) {
      g.schedule.remindersEnabled = false;
      // NOTE: OUTCOME may keep schedule for planning visibility, but reminders are always forced OFF here.
    }
  } else {
    g.schedule = undefined;
  }

  g.resetPolicy = normalizeResetPolicy(g.resetPolicy);

  return g;
}

export function initialData() {
  return {
    profile: {
      name: "",
      lastName: "",
      whyText: "",
      whyImage: "",
      whyUpdatedAt: "",
      plan: "free",
      xp: 0,
      level: 1,
      rewardClaims: {},
    },
    ui: {
      blocksSchemaVersion: BLOCKS_SCHEMA_VERSION,
      blocksByPage: getDefaultBlocksByPage(),
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: null,

      // V3: per-view focus (used to decouple Today/Library/Plan later)
      selectedCategoryByView: {
        home: null,
        library: null,
        plan: null,
        pilotage: null,
      },

      // V2: per-page theming
      pageThemes: { home: "aurora" },
      pageAccents: { home: "#7C3AED" },

      // legacy (kept for backward compatibility during migration)
      pageThemeHome: "aurora",
      accentHome: "#7C3AED",

      // V2: one active goal at a time
      activeGoalId: null,
      mainGoalId: null,
      selectedGoalByCategory: {},
      categoryRailOrder: [],
      onboardingCompleted: false,
      onboardingSeenVersion: 0,
      onboardingStep: 1,
      tutorialEnabled: false,
      tutorialStep: null,
      tourSeenVersion: 0,
      tourStepIndex: 0,
      tourForceStart: false,
      permissions: {
        notifications: "unknown",
        calendar: "unknown",
        health: "unknown",
      },
      isDragging: false,
      creationFlowVersion: "v2",
      createDraft: null,
      showPlanStep: false,
      soundEnabled: false,
      selectedDate: toLocalDateKey(),
      selectedHabits: {},
      sessionDraft: null,
      activeSession: null,
    },
    categories: [],
    goals: [],
    habits: [],
    reminders: [],
    sessions: [],
    occurrences: [],
    checks: {},
  };
}

export function demoData() {
  const categories = [
    { id: "demo_cat_1", name: "Catégorie 1", color: "#7C3AED", wallpaper: "", mainGoalId: null },
    { id: "demo_cat_2", name: "Catégorie 2", color: "#06B6D4", wallpaper: "", mainGoalId: null },
    { id: "demo_cat_3", name: "Catégorie 3", color: "#22C55E", wallpaper: "", mainGoalId: null },
  ];
  const outcomeId = uid();
  const processId = uid();

  return {
    profile: {
      name: "Démo",
      lastName: "",
      whyText: "Exemple de pourquoi (démo).",
      whyImage: "",
      whyUpdatedAt: "",
      plan: "free",
      xp: 0,
      level: 1,
      rewardClaims: {},
    },
    ui: {
      blocksSchemaVersion: BLOCKS_SCHEMA_VERSION,
      blocksByPage: getDefaultBlocksByPage(),
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: categories[0].id,

      selectedCategoryByView: {
        home: categories[0].id,
        library: categories[0].id,
        plan: categories[0].id,
        pilotage: categories[0].id,
      },

      pageThemes: { home: "aurora" },
      pageAccents: { home: "#7C3AED" },
      pageThemeHome: "aurora",
      accentHome: "#7C3AED",
      activeGoalId: null,
      mainGoalId: outcomeId,
      selectedGoalByCategory: {},
      categoryRailOrder: [],
      onboardingCompleted: true,
      onboardingSeenVersion: 2,
      onboardingStep: 3,
      tutorialEnabled: false,
      tutorialStep: null,
      tourSeenVersion: 0,
      tourStepIndex: 0,
      tourForceStart: false,
      permissions: {
        notifications: "unknown",
        calendar: "unknown",
        health: "unknown",
      },
      isDragging: false,
      creationFlowVersion: "v2",
      createDraft: null,
      showPlanStep: false,
      soundEnabled: false,
      selectedDate: toLocalDateKey(),
      selectedHabits: {},
      sessionDraft: null,
      activeSession: null,
    },
    categories: categories.map((c, idx) => ({ ...c, mainGoalId: idx === 0 ? outcomeId : c.mainGoalId })),
    goals: [
      {
        id: outcomeId,
        categoryId: categories[0].id,
        title: "Résultat démo",
        type: "OUTCOME",
        planType: "STATE",
        status: "active",
        deadline: "",
      },
      {
        id: processId,
        categoryId: categories[1].id,
        title: "Processus démo",
        type: "PROCESS",
        planType: "ACTION",
        status: "queued",
        cadence: "WEEKLY",
        target: 3,
        freqCount: 3,
        freqUnit: "WEEK",
        sessionMinutes: 30,
        parentId: outcomeId,
        weight: 100,
      },
    ],
    habits: [
      { id: uid(), categoryId: categories[0].id, title: "Action 1", cadence: "WEEKLY", target: 2 },
      { id: uid(), categoryId: categories[1].id, title: "Action 2", cadence: "DAILY", target: 1 },
    ],
    reminders: [],
    sessions: [],
    checks: {},
  };
}

export function migrate(prev) {
  let next = prev && typeof prev === "object" ? { ...prev } : initialData();

  // profile
  if (!next.profile) next.profile = {};
  if (typeof next.profile.lastName !== "string") next.profile.lastName = "";
  if (typeof next.profile.xp !== "number") next.profile.xp = 0;
  if (typeof next.profile.level !== "number") next.profile.level = 1;
  if (!next.profile.rewardClaims || typeof next.profile.rewardClaims !== "object") next.profile.rewardClaims = {};
  if (typeof next.profile.whyUpdatedAt !== "string") next.profile.whyUpdatedAt = "";
  if (typeof next.profile.plan !== "string") next.profile.plan = "free";

  // ui
  if (!next.ui) next.ui = {};
  if (!Array.isArray(next.ui.blocks) || next.ui.blocks.length === 0)
    next.ui.blocks = DEFAULT_BLOCKS.map((b) => ({ ...b }));
  if (typeof next.ui.blocksSchemaVersion !== "number") next.ui.blocksSchemaVersion = BLOCKS_SCHEMA_VERSION;
  if (!next.ui.blocksByPage || typeof next.ui.blocksByPage !== "object") {
    const seeded = { ...getDefaultBlocksByPage() };
    // Keep a legacy snapshot to avoid losing old configs (even if not used anymore).
    if (Array.isArray(next.ui.blocks)) seeded.legacy = next.ui.blocks.map((b) => ({ ...b }));
    next.ui.blocksByPage = ensureBlocksConfig(seeded);
  } else {
    next.ui.blocksByPage = ensureBlocksConfig(next.ui.blocksByPage);
  }
  const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
  if (isDev) {
    const audit = validateBlocksState(next);
    if (!audit.ok) {
      // eslint-disable-next-line no-console
      console.warn("[blocks] invalid blocksByPage", audit.issues);
    }
  }
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
  if (!next.ui.selectedGoalByCategory || typeof next.ui.selectedGoalByCategory !== "object") {
    next.ui.selectedGoalByCategory = {};
  }
  if (!Array.isArray(next.ui.categoryRailOrder)) next.ui.categoryRailOrder = [];

  // V3: per-view selected category (decouple Today/Library/Plan)
  if (!next.ui.selectedCategoryByView || typeof next.ui.selectedCategoryByView !== "object") {
    next.ui.selectedCategoryByView = { home: null, library: null, plan: null, pilotage: null };
  } else {
    if (typeof next.ui.selectedCategoryByView.home === "undefined") next.ui.selectedCategoryByView.home = null;
    if (typeof next.ui.selectedCategoryByView.library === "undefined") next.ui.selectedCategoryByView.library = null;
    if (typeof next.ui.selectedCategoryByView.plan === "undefined") next.ui.selectedCategoryByView.plan = null;
    if (typeof next.ui.selectedCategoryByView.pilotage === "undefined") next.ui.selectedCategoryByView.pilotage = null;
  }

  // Backfill per-view focus from legacy selectedCategoryId (one-time initialization)
  // Goal: views can diverge later without being coupled via selectedCategoryId.
  if (!next.ui.selectedCategoryByView.home) {
    next.ui.selectedCategoryByView.home = next.ui.selectedCategoryId || null;
  }
  if (!next.ui.selectedCategoryByView.library) {
    next.ui.selectedCategoryByView.library = next.ui.selectedCategoryId || null;
  }
  if (!next.ui.selectedCategoryByView.plan) {
    next.ui.selectedCategoryByView.plan = next.ui.selectedCategoryId || null;
  }
  if (!next.ui.selectedCategoryByView.pilotage) {
    next.ui.selectedCategoryByView.pilotage = next.ui.selectedCategoryId || null;
  }

  if (typeof next.ui.soundEnabled === "undefined") next.ui.soundEnabled = false;
  if (typeof next.ui.onboardingCompleted === "undefined") next.ui.onboardingCompleted = false;
  if (typeof next.ui.onboardingSeenVersion !== "number") next.ui.onboardingSeenVersion = 0;
  if (typeof next.ui.onboardingStep === "undefined") next.ui.onboardingStep = 1;
  if (typeof next.ui.tutorialEnabled === "undefined") next.ui.tutorialEnabled = false;
  if (typeof next.ui.tutorialStep === "undefined") next.ui.tutorialStep = null;
  if (typeof next.ui.tourSeenVersion !== "number") next.ui.tourSeenVersion = 0;
  if (typeof next.ui.tourStepIndex !== "number") next.ui.tourStepIndex = 0;
  if (typeof next.ui.tourForceStart !== "boolean") next.ui.tourForceStart = false;
  if (typeof next.ui.isDragging !== "boolean") next.ui.isDragging = false;
  if (!next.ui.permissions || typeof next.ui.permissions !== "object") next.ui.permissions = {};
  if (typeof next.ui.permissions.notifications !== "string") next.ui.permissions.notifications = "unknown";
  if (typeof next.ui.permissions.calendar !== "string") next.ui.permissions.calendar = "unknown";
  if (typeof next.ui.permissions.health !== "string") next.ui.permissions.health = "unknown";
  if (next.ui.creationFlowVersion !== "legacy" && next.ui.creationFlowVersion !== "v2") {
    next.ui.creationFlowVersion = "legacy";
  }
  if (typeof next.ui.createDraft === "undefined") next.ui.createDraft = null;
  if (next.ui.createDraft && typeof next.ui.createDraft !== "object") next.ui.createDraft = null;
  if (typeof next.ui.showPlanStep === "undefined") next.ui.showPlanStep = false;
  if (!next.ui.selectedHabits || typeof next.ui.selectedHabits !== "object") next.ui.selectedHabits = {};
  if (typeof next.ui.sessionDraft === "undefined") next.ui.sessionDraft = null;
  if (typeof next.ui.activeSession === "undefined") next.ui.activeSession = null;
  {
    const raw = typeof next.ui.selectedDate === "string" ? next.ui.selectedDate : "";
    const parsed = raw ? new Date(`${raw}T12:00:00`) : null;
    const normalized = parsed && !Number.isNaN(parsed.getTime()) ? toLocalDateKey(parsed) : toLocalDateKey();
    next.ui.selectedDate = normalized;
  }

  // categories
  if (!Array.isArray(next.categories)) next.categories = [];
  next.categories = next.categories.map((cat, i) => normalizeCategory(cat, i));

  // Ensure selectedCategoryId always points to an existing category (or null)
  // NOTE: This legacy field is only kept for backward compatibility and should NOT drive per-view selection anymore.
  if (next.ui?.selectedCategoryId) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryId);
    if (!exists) next.ui.selectedCategoryId = next.categories[0]?.id || null;
  }

  // Ensure per-view home selection is valid as well
  if (next.ui?.selectedCategoryByView?.home) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.home);
    if (!exists) next.ui.selectedCategoryByView.home = next.categories[0]?.id || null;
  }

  // Ensure per-view library selection is valid
  if (next.ui?.selectedCategoryByView?.library) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.library);
    if (!exists) next.ui.selectedCategoryByView.library = next.categories[0]?.id || null;
  }

  // Ensure per-view plan selection is valid
  if (next.ui?.selectedCategoryByView?.plan) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.plan);
    if (!exists) next.ui.selectedCategoryByView.plan = next.categories[0]?.id || null;
  }
  // Ensure per-view pilotage selection is valid
  if (next.ui?.selectedCategoryByView?.pilotage) {
    const exists = next.categories.some((c) => c.id === next.ui.selectedCategoryByView.pilotage);
    if (!exists) next.ui.selectedCategoryByView.pilotage = next.categories[0]?.id || null;
  }

  // goals (V2 normalize)
  if (!Array.isArray(next.goals)) next.goals = [];
  if (!Array.isArray(next.habits)) next.habits = [];
  next.habits = next.habits.map((h, i) => normalizeLegacyHabit(h, i));
  next.goals = next.goals.map((g) => backfillGoalLegacyFields(g));
  next = mergeLegacyHabitsIntoGoals(next);
  next.goals = next.goals.map((g) => backfillGoalLegacyFields(g));
  next.goals = next.goals.map((g, i) => normalizeGoal(g, i, next.categories));
  next.goals = next.goals.map((g) => ({
    ...g,
    status: g.status === "abandoned" ? "invalid" : g.status,
  }));

  // --- Semantic cleanup: prevent cross-category / invalid parent links (PROCESS -> OUTCOME only)
  {
    const byId = new Map(next.goals.map((g) => [g.id, g]));
    next.goals = next.goals.map((g) => {
      if (!g || typeof g !== "object") return g;
      const t = (g.type || g.kind || "").toString().toUpperCase();
      if (t !== "PROCESS") return g;

      const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
      if (!rawParent) {
        // Ensure both legacy fields are aligned
        return { ...g, parentId: null, primaryGoalId: null };
      }

      const parent = byId.get(rawParent);
      const parentType = (parent?.type || parent?.kind || "").toString().toUpperCase();
      const parentOk = Boolean(parent && parentType === "OUTCOME" && parent.categoryId && parent.categoryId === g.categoryId);

      if (!parentOk) {
        // Do NOT delete the habit; just detach it.
        return { ...g, parentId: null, primaryGoalId: null };
      }

      // Keep both fields consistent
      return { ...g, parentId: parent.id, primaryGoalId: parent.id };
    });
  }

  const goalsById = new Map(next.goals.map((g) => [g.id, g]));

  // Enforce: mainGoalId reflects only the OUTCOME with priority === "prioritaire"
  const prioritaireByCategory = new Map();
  for (const g of next.goals) {
    const t = (g?.type || g?.kind || "").toString().toUpperCase();
    if (t !== "OUTCOME") continue;
    if (!g.categoryId) continue;
    if (g.priority !== "prioritaire") continue;

    const prevBest = prioritaireByCategory.get(g.categoryId);
    if (!prevBest) {
      prioritaireByCategory.set(g.categoryId, g);
      continue;
    }

    const orderScore = (x) => (typeof x.order === "number" ? x.order : Number.POSITIVE_INFINITY);
    if (orderScore(g) < orderScore(prevBest)) prioritaireByCategory.set(g.categoryId, g);
  }

  if (prioritaireByCategory.size) {
    next.goals = next.goals.map((g) => {
      const t = (g?.type || g?.kind || "").toString().toUpperCase();
      if (t !== "OUTCOME") return g;
      if (!g.categoryId || g.priority !== "prioritaire") return g;
      const picked = prioritaireByCategory.get(g.categoryId);
      if (picked && picked.id === g.id) return g;
      return { ...g, priority: "secondaire" };
    });
  }

  next.categories = next.categories.map((cat) => {
    const picked = prioritaireByCategory.get(cat.id) || null;
    return { ...cat, mainGoalId: picked ? picked.id : null };
  });

  // `mainGoalId` is a UI convenience, but it must follow the Today (home) context,
  // not the legacy global `selectedCategoryId` (which is kept for backward compatibility).
  const homeCategoryId = next.ui?.selectedCategoryByView?.home || next.ui?.selectedCategoryId || null;
  const homeCategoryForMain =
    next.categories.find((cat) => cat.id === homeCategoryId) || next.categories[0] || null;
  next.ui.mainGoalId = homeCategoryForMain?.mainGoalId || null;

  // Onboarding completion rule:
  if (!next.ui.onboardingCompleted) {
    const step = Number(next.ui.onboardingStep) || 1;
    const nameOk = Boolean((next.profile?.name || "").trim());
    const whyOk = Boolean((next.profile?.whyText || "").trim());
    const hasCategory = next.categories.length > 0;

    const outcomeIds = new Set(
      next.goals
        .filter((g) => (g?.type || g?.kind || "").toString().toUpperCase() === "OUTCOME")
        .map((g) => g.id)
    );
    const hasOutcome = outcomeIds.size > 0;

    const hasProcess = next.goals.some(
      (g) => (g?.type || g?.kind || "").toString().toUpperCase() === "PROCESS" && outcomeIds.has(g.parentId)
    );

    if (step >= 3 && nameOk && whyOk && hasCategory && hasOutcome && hasProcess) {
      next.ui.onboardingCompleted = true;
    }
  }

  // habits/checks
  if (!Array.isArray(next.reminders)) next.reminders = [];
  next.reminders = next.reminders.map((r, i) => normalizeReminder(r, i));
  if (!Array.isArray(next.sessions)) next.sessions = [];
  next.sessions = next.sessions.map((s) => normalizeSession(s));
  if (!Array.isArray(next.occurrences)) next.occurrences = [];
  if (!next.checks || typeof next.checks !== "object") next.checks = {};

  const normalized = normalizeGoalsState(next);

  // Defensive re-validation after normalizeGoalsState
  {
    const cats = Array.isArray(normalized.categories) ? normalized.categories : [];
    const goals = Array.isArray(normalized.goals) ? normalized.goals : [];
    const byId = new Map(goals.map((g) => [g.id, g]));

    const fixedCategories = cats.map((cat) => {
      const outcomes = goals.filter(
        (x) =>
          (x?.type || x?.kind || "").toString().toUpperCase() === "OUTCOME" &&
          x.categoryId === cat.id &&
          x.priority === "prioritaire"
      );
      if (!outcomes.length) return { ...cat, mainGoalId: null };

      const orderScore = (x) => (typeof x.order === "number" ? x.order : Number.POSITIVE_INFINITY);
      let best = outcomes[0];
      for (const o of outcomes.slice(1)) if (orderScore(o) < orderScore(best)) best = o;
      return { ...cat, mainGoalId: best.id };
    });

    normalized.categories = fixedCategories;

    const homeCatId = normalized.ui?.selectedCategoryByView?.home || normalized.ui?.selectedCategoryId || fixedCategories[0]?.id || null;
    const homeCat = homeCatId ? fixedCategories.find((c) => c.id === homeCatId) || null : null;
    normalized.ui = {
      ...(normalized.ui || {}),
      mainGoalId: homeCat?.mainGoalId || null,
    };
  }

  // Re-validate per-view selections after normalizeGoalsState
  const cats = Array.isArray(normalized.categories) ? normalized.categories : [];
  const first = cats[0]?.id || null;
  const goalList = Array.isArray(normalized.goals) ? normalized.goals : [];

  const scv = normalized.ui?.selectedCategoryByView || { home: null, library: null, plan: null, pilotage: null };

  const safeHome = scv.home && cats.some((c) => c.id === scv.home) ? scv.home : first;
  const safeLibrary = scv.library && cats.some((c) => c.id === scv.library) ? scv.library : first;
  const safePlan = scv.plan && cats.some((c) => c.id === scv.plan) ? scv.plan : first;
  const safePilotage = scv.pilotage && cats.some((c) => c.id === scv.pilotage) ? scv.pilotage : first;

  // Keep legacy `selectedCategoryId` as the Plan context to avoid coupling Today/Library to it.
  const legacySelectedCategoryId = safePlan || null;
  const rawLibrarySelected = normalized.ui?.librarySelectedCategoryId || null;
  const safeLibrarySelected = rawLibrarySelected && cats.some((c) => c.id === rawLibrarySelected) ? rawLibrarySelected : null;
  const rawOpenGoalEditId = normalized.ui?.openGoalEditId || null;
  const safeOpenGoalEditId = rawOpenGoalEditId && goalList.some((g) => g.id === rawOpenGoalEditId) ? rawOpenGoalEditId : null;

  return {
    ...normalized,
    ui: {
      ...(normalized.ui || {}),
      selectedCategoryId: legacySelectedCategoryId,
      mainGoalId: normalized.ui?.mainGoalId || null,
      librarySelectedCategoryId: safeLibrarySelected,
      openGoalEditId: safeOpenGoalEditId,
      selectedCategoryByView: {
        home: safeHome,
        library: safeLibrary,
        plan: safePlan,
        pilotage: safePilotage,
      },
    },
  };
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
