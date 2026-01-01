// src/logic/state.js
import { loadState, saveState } from "../utils/storage";
import { uid } from "../utils/helpers";
import { normalizeGoalsState } from "./goals";
import { normalizeReminder } from "./reminders";
import { todayKey } from "../utils/dates";

export const THEME_PRESETS = ["aurora", "midnight", "sunset", "ocean", "forest"];

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
  }

  if (isProcess) {
    // Remove outcome fields
    g.deadline = "";
    g.metric = null;
    g.notes = "";

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
  const shouldHaveSchedule = isProcess && g.planType === "ACTION";
  if (shouldHaveSchedule) {
    if (!g.schedule || typeof g.schedule !== "object") {
      g.schedule = createDefaultGoalSchedule();
    } else {
      // Merge with defaults to be resilient to future schema changes.
      g.schedule = { ...createDefaultGoalSchedule(), ...g.schedule };

      if (!Array.isArray(g.schedule.daysOfWeek)) g.schedule.daysOfWeek = createDefaultGoalSchedule().daysOfWeek;
      if (!Array.isArray(g.schedule.timeSlots)) g.schedule.timeSlots = createDefaultGoalSchedule().timeSlots;
      if (typeof g.schedule.timezone !== "string") g.schedule.timezone = createDefaultGoalSchedule().timezone;

      if (typeof g.schedule.durationMinutes !== "number")
        g.schedule.durationMinutes = createDefaultGoalSchedule().durationMinutes;
      if (typeof g.schedule.remindBeforeMinutes !== "number")
        g.schedule.remindBeforeMinutes = createDefaultGoalSchedule().remindBeforeMinutes;
      if (typeof g.schedule.allowSnooze !== "boolean") g.schedule.allowSnooze = createDefaultGoalSchedule().allowSnooze;
      if (typeof g.schedule.snoozeMinutes !== "number")
        g.schedule.snoozeMinutes = createDefaultGoalSchedule().snoozeMinutes;
      if (typeof g.schedule.remindersEnabled !== "boolean")
        g.schedule.remindersEnabled = createDefaultGoalSchedule().remindersEnabled;
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
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: null,

      // V3: per-view focus (used to decouple Today/Library/Plan later)
      selectedCategoryByView: {
        home: null,
        library: null,
        plan: null,
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
      onboardingCompleted: false,
      onboardingStep: 1,
      showPlanStep: false,
      soundEnabled: false,
      selectedDate: todayKey(),
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
      blocks: DEFAULT_BLOCKS.map((b) => ({ ...b })),
      selectedCategoryId: categories[0].id,

      selectedCategoryByView: {
        home: categories[0].id,
        library: categories[0].id,
        plan: categories[0].id,
      },

      pageThemes: { home: "aurora" },
      pageAccents: { home: "#7C3AED" },
      pageThemeHome: "aurora",
      accentHome: "#7C3AED",
      activeGoalId: null,
      mainGoalId: outcomeId,
      selectedGoalByCategory: {},
      onboardingCompleted: true,
      onboardingStep: 3,
      showPlanStep: false,
      soundEnabled: false,
      selectedDate: todayKey(),
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

  // V3: per-view selected category (decouple Today/Library/Plan)
  if (!next.ui.selectedCategoryByView || typeof next.ui.selectedCategoryByView !== "object") {
    next.ui.selectedCategoryByView = { home: null, library: null, plan: null };
  } else {
    if (typeof next.ui.selectedCategoryByView.home === "undefined") next.ui.selectedCategoryByView.home = null;
    if (typeof next.ui.selectedCategoryByView.library === "undefined") next.ui.selectedCategoryByView.library = null;
    if (typeof next.ui.selectedCategoryByView.plan === "undefined") next.ui.selectedCategoryByView.plan = null;
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

  if (typeof next.ui.soundEnabled === "undefined") next.ui.soundEnabled = false;
  if (typeof next.ui.onboardingCompleted === "undefined") next.ui.onboardingCompleted = false;
  if (typeof next.ui.onboardingStep === "undefined") next.ui.onboardingStep = 1;
  if (typeof next.ui.showPlanStep === "undefined") next.ui.showPlanStep = false;
  {
    const raw = typeof next.ui.selectedDate === "string" ? next.ui.selectedDate : "";
    const parsed = raw ? new Date(`${raw}T12:00:00`) : null;
    const normalized = parsed && !Number.isNaN(parsed.getTime()) ? todayKey(parsed) : todayKey();
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

  // goals (V2 normalize)
  if (!Array.isArray(next.goals)) next.goals = [];
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

  // Enforce: exactly 1 main OUTCOME goal per category (categories store mainGoalId)
  // Rules:
  // - mainGoalId must point to an OUTCOME belonging to the category
  // - if invalid/missing, pick the best OUTCOME in that category
  // - never use ui.mainGoalId as a cross-category fallback

  const outcomeByCategory = new Map();
  for (const g of next.goals) {
    const t = (g?.type || g?.kind || "").toString().toUpperCase();
    if (t !== "OUTCOME") continue;
    if (!g.categoryId) continue;

    const prevBest = outcomeByCategory.get(g.categoryId);
    if (!prevBest) {
      outcomeByCategory.set(g.categoryId, g);
      continue;
    }

    // Prefer active over queued, then earlier order, then most recent activity/creation.
    const score = (x) => {
      const s1 = x.status === "active" ? 3 : x.status === "queued" ? 2 : 1;
      const s2 = typeof x.order === "number" ? -x.order : 0;
      const ts = Date.parse(x.activeSince || x.createdAt || "") || 0;
      return s1 * 1_000_000 + s2 * 1_000 + ts;
    };

    if (score(g) > score(prevBest)) outcomeByCategory.set(g.categoryId, g);
  }

  next.categories = next.categories.map((cat) => {
    const rawMainId = typeof cat.mainGoalId === "string" ? cat.mainGoalId.trim() : "";
    const mainId = rawMainId || "";
    const candidate = mainId ? goalsById.get(mainId) : null;

    const candidateType = (candidate?.type || candidate?.kind || "").toString().toUpperCase();
    const candidateOk = Boolean(candidate && candidateType === "OUTCOME" && candidate.categoryId === cat.id);

    if (candidateOk) {
      return { ...cat, mainGoalId: candidate.id };
    }

    const bestOutcome = outcomeByCategory.get(cat.id) || null;
    if (bestOutcome) {
      return { ...cat, mainGoalId: bestOutcome.id };
    }

    return { ...cat, mainGoalId: null };
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
  if (!Array.isArray(next.habits)) next.habits = [];
  if (!Array.isArray(next.reminders)) next.reminders = [];
  next.reminders = next.reminders.map((r, i) => normalizeReminder(r, i));
  if (!next.checks || typeof next.checks !== "object") next.checks = {};

  const normalized = normalizeGoalsState(next);

  // Defensive re-validation after normalizeGoalsState
  {
    const cats = Array.isArray(normalized.categories) ? normalized.categories : [];
    const goals = Array.isArray(normalized.goals) ? normalized.goals : [];
    const byId = new Map(goals.map((g) => [g.id, g]));

    const fixedCategories = cats.map((cat) => {
      const raw = typeof cat.mainGoalId === "string" ? cat.mainGoalId.trim() : "";
      const g = raw ? byId.get(raw) : null;
      const t = (g?.type || g?.kind || "").toString().toUpperCase();
      if (g && t === "OUTCOME" && g.categoryId === cat.id) return cat;

      // pick best OUTCOME if needed
      const outcomes = goals.filter((x) => (x?.type || x?.kind || "").toString().toUpperCase() === "OUTCOME" && x.categoryId === cat.id);
      if (!outcomes.length) return { ...cat, mainGoalId: null };

      const score = (x) => {
        const s1 = x.status === "active" ? 3 : x.status === "queued" ? 2 : 1;
        const s2 = typeof x.order === "number" ? -x.order : 0;
        const ts = Date.parse(x.activeSince || x.createdAt || "") || 0;
        return s1 * 1_000_000 + s2 * 1_000 + ts;
      };

      let best = outcomes[0];
      for (const o of outcomes.slice(1)) if (score(o) > score(best)) best = o;
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

  const scv = normalized.ui?.selectedCategoryByView || { home: null, library: null, plan: null };

  const safeHome = scv.home && cats.some((c) => c.id === scv.home) ? scv.home : first;
  const safeLibrary = scv.library && cats.some((c) => c.id === scv.library) ? scv.library : first;
  const safePlan = scv.plan && cats.some((c) => c.id === scv.plan) ? scv.plan : first;

  // Keep legacy `selectedCategoryId` as the Plan context to avoid coupling Today/Library to it.
  const legacySelectedCategoryId = safePlan || null;

  return {
    ...normalized,
    ui: {
      ...(normalized.ui || {}),
      selectedCategoryId: legacySelectedCategoryId,
      mainGoalId: normalized.ui?.mainGoalId || null,
      selectedCategoryByView: {
        home: safeHome,
        library: safeLibrary,
        plan: safePlan,
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
