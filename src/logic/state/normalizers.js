import { uid } from "../../utils/helpers";
import { normalizeLocalDateKey, toLocalDateKey } from "../../utils/dateKey";
import { resolveGoalType, isOutcome, isProcess } from "../../domain/goalType";
import { normalizeTimeFields } from "../timeFields";
import { BLOCKS_SCHEMA_VERSION, getDefaultBlocksByPage } from "../blocks/registry";
import { BRAND_ACCENT } from "../../theme/themeTokens";
import { DEFAULT_CATEGORY_ID, SYSTEM_INBOX_ID } from "./inbox";
import {
  SCHEMA_VERSION,
  MEASURE_TYPES,
  TRACKING_MODES,
  normalizeLifecycleMode,
  normalizeCompletionMode,
  normalizeMissPolicy,
  normalizeInt,
  normalizeFloat,
  normalizeDateKeyLoose,
  addDaysDateKey,
  compareDateKeys,
  normalizeScheduleMode,
  normalizeWeeklySlotsByDay,
  normalizeDaysOfWeek,
  normalizeRepeat,
  normalizeStartTime,
  normalizeDurationMinutes,
  normalizeQuantityValue,
  normalizeQuantityUnit,
  normalizeQuantityPeriod,
} from "./_shared";

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
export const DEMO_MODE = false;
export function createDefaultGoalSchedule() {
  return {
    timezone: "Europe/Paris",

    // Weekly defaults (user will later edit in UI)
    // 1 = Monday ... 7 = Sunday
    daysOfWeek: [1, 2, 3, 4, 5, 6, 7],
    timeSlots: ["00:00"], // HH:mm

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
  if (c.id === SYSTEM_INBOX_ID) {
    c.name = "Général";
    c.system = true;
  }
  if (typeof c.name !== "string" || !c.name.trim()) c.name = `Catégorie ${index + 1}`;
  if (typeof c.color !== "string" || !c.color.trim()) c.color = "#7C3AED";
  if (typeof c.wallpaper !== "string") c.wallpaper = "";
  if (typeof c.whyText !== "string") c.whyText = "";
  if (typeof c.templateId !== "string" || !c.templateId.trim()) c.templateId = null;
  c.mainGoalId = typeof c.mainGoalId === "string" && c.mainGoalId.trim() ? c.mainGoalId : null;
  c.system = Boolean(c.system);
  if (typeof c.createdAt !== "string") c.createdAt = "";
  return c;
}
export function ensureCategoryId(entity, fallbackId = DEFAULT_CATEGORY_ID) {
  const next = entity && typeof entity === "object" ? { ...entity } : {};
  const raw = typeof next.categoryId === "string" ? next.categoryId.trim() : "";
  next.categoryId = raw || fallbackId;
  return next;
}

export function normalizeGoal(rawGoal, index = 0) {
  const g = rawGoal && typeof rawGoal === "object" ? { ...rawGoal } : {};

  if (!g.id) g.id = uid();
  const rawCategoryId = typeof g.categoryId === "string" ? g.categoryId.trim() : "";
  g.categoryId = rawCategoryId || null;

  const goalType = resolveGoalType(g);
  const outcome = goalType === "OUTCOME";
  const process = goalType === "PROCESS";
  const inferredPlanType = g.oneOffDate ? "ONE_OFF" : "ACTION";

  g.categoryId = ensureCategoryId(g).categoryId;

  const rawOutcomeId = typeof g.outcomeId === "string" ? g.outcomeId.trim() : "";
  const rawObjectiveId = typeof g.objectiveId === "string" ? g.objectiveId.trim() : "";
  const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
  g.parentId = rawParent || rawOutcomeId || rawObjectiveId || null;
  g.outcomeId = g.parentId || null;
  if (typeof g.objectiveId === "string") g.objectiveId = null;

  // Canonical semantics:
  // - OUTCOME = objective (STATE) : can carry metric/deadline/notes, but never scheduling/frequency/session/parent.
  // - PROCESS = habit (ACTION or ONE_OFF) : can carry frequency/session/oneOffDate, but never metric/deadline/notes.
  if (!g.type && outcome) g.type = "OUTCOME";
  if (!g.type && process) g.type = "PROCESS";
  if (!g.planType && outcome) g.planType = "STATE";
  if (!g.planType && process) g.planType = inferredPlanType;
  if (!g.kind && outcome) g.kind = "OUTCOME";
  if (!g.kind && process) g.kind = "ACTION";

  if (!g.title) g.title = "Projet";
  if (!outcome) {
    if (!g.cadence) g.cadence = "WEEKLY";
    if (typeof g.target !== "number") g.target = 1;
  }

  if (typeof g.templateId !== "string") g.templateId = null;
  if (outcome) g.templateType = "GOAL";
  else if (process) g.templateType = "HABIT";
  else if (typeof g.templateType !== "string") g.templateType = null;

  // Optional: deadline as ISO date (YYYY-MM-DD). Empty string means "no deadline yet".
  if (typeof g.deadline !== "string") g.deadline = "";
  if (typeof g.notes !== "string") g.notes = "";
  const rawStartDate = typeof g.startDate === "string" ? g.startDate.trim() : "";
  g.startDate = normalizeLocalDateKey(rawStartDate) || "";

  // V3: lifecycle (period) + optional location context
  // NOTE: For PROCESS goals, a period is mandatory (activeFrom/activeTo).
  // For OUTCOME goals, lifecycle is ignored.
  g.lifecycleMode = normalizeLifecycleMode(g.lifecycleMode) || "";
  g.activeFrom = normalizeDateKeyLoose(g.activeFrom) || "";
  g.activeTo = normalizeDateKeyLoose(g.activeTo) || "";

  // Optional location (premium context)
  if (typeof g.locationLabel !== "string") g.locationLabel = "";
  if (typeof g.locationAddress !== "string") g.locationAddress = "";
  g.locationLat = normalizeFloat(g.locationLat, { min: -90, max: 90 });
  g.locationLng = normalizeFloat(g.locationLng, { min: -180, max: 180 });
  g.locationRadiusMeters = normalizeInt(g.locationRadiusMeters, { min: 10, max: 20000 });

  const rawTracking = typeof g.trackingMode === "string" ? g.trackingMode.trim() : "";
  if (outcome) g.trackingMode = TRACKING_MODES.has(rawTracking) ? rawTracking : "none";
  if (process) g.trackingMode = "none";

  // Optional: measurement fields for OUTCOME goals.
  const rawMeasure = typeof g.measureType === "string" ? g.measureType.trim() : "";
  g.measureType = MEASURE_TYPES.has(rawMeasure) ? rawMeasure : null;
  const rawTarget = typeof g.targetValue === "string" ? Number(g.targetValue) : g.targetValue;
  const rawCurrent = typeof g.currentValue === "string" ? Number(g.currentValue) : g.currentValue;
  g.targetValue = Number.isFinite(rawTarget) && rawTarget > 0 ? rawTarget : null;
  g.currentValue = Number.isFinite(rawCurrent) && rawCurrent >= 0 ? rawCurrent : null;
  if (!g.targetValue) g.currentValue = null;

  if (typeof g.habitNotes !== "string") g.habitNotes = "";
  const quantityValue = normalizeQuantityValue(g.quantityValue);
  const quantityUnit = normalizeQuantityUnit(g.quantityUnit);
  const quantityPeriod = normalizeQuantityPeriod(g.quantityPeriod);
  if (quantityValue && quantityUnit) {
    g.quantityValue = quantityValue;
    g.quantityUnit = quantityUnit;
    g.quantityPeriod = quantityPeriod;
  } else {
    g.quantityValue = null;
    g.quantityUnit = "";
    g.quantityPeriod = "";
  }
  g.reminderTime = normalizeStartTime(g.reminderTime);
  g.reminderWindowStart = normalizeStartTime(g.reminderWindowStart);
  g.reminderWindowEnd = normalizeStartTime(g.reminderWindowEnd);

  // Strict separation:
  // OUTCOME (objective): keep metric/deadline/notes, but remove any habit/scheduling fields.
  // PROCESS (habit): keep planning/frequency fields, but remove any outcome fields.
  if (outcome) {
    // Remove habit fields
    g.cadence = undefined;
    g.target = undefined;
    g.freqUnit = undefined;
    g.freqCount = undefined;
    g.sessionMinutes = null;
    g.oneOffDate = undefined;
    g.habitNotes = "";
    g.quantityValue = null;
    g.quantityUnit = "";
    g.quantityPeriod = "";
    g.reminderTime = "";
    g.reminderWindowStart = "";
    g.reminderWindowEnd = "";

    // Remove scheduling remnants
    g.startAt = null;
    g.endAt = null;

    // Remove lifecycle + location (OUTCOME does not carry execution lifecycle)
    g.lifecycleMode = "";
    g.activeFrom = "";
    g.activeTo = "";
    g.locationLabel = "";
    g.locationAddress = "";
    g.locationLat = null;
    g.locationLng = null;
    g.locationRadiusMeters = null;

    // Remove advanced process scheduling fields (must never live on OUTCOME)
    g.scheduleMode = undefined;
    g.weeklySlotsByDay = undefined;
    if (g.schedule && typeof g.schedule === "object") {
      const sched = { ...g.schedule };
      delete sched.scheduleMode;
      delete sched.weeklySlotsByDay;
      g.schedule = sched;
    }

    // Outcome is the parent, never a child
    g.parentId = null;
    g.primaryGoalId = null;
    g.weight = 0;
    g.linkWeight = 0;
    g.outcomeId = null;

    if (!g.measureType) {
      g.targetValue = null;
      g.currentValue = null;
    }
  }

  if (process) {
    // Remove outcome fields
    g.deadline = "";
    g.metric = null;
    g.notes = "";
    g.measureType = null;
    g.targetValue = null;
    g.currentValue = null;

    // PROCESS lifecycle: mandatory period.
    // Rules:
    // - ONE_OFF: activeFrom = oneOffDate, activeTo = oneOffDate
    // - ACTION (recurring/anytime): default period = 30 days starting today if missing
    // - If activeTo < activeFrom, clamp activeTo to activeFrom
    const todayKey = toLocalDateKey();
    const existingFrom = g.activeFrom || "";
    const existingTo = g.activeTo || "";

    // Default lifecycleMode
    if (!g.lifecycleMode) g.lifecycleMode = "FIXED";

    if (g.planType === "ONE_OFF") {
      const oneOff = normalizeDateKeyLoose(g.oneOffDate);
      g.activeFrom = oneOff || existingFrom || todayKey;
      g.activeTo = g.activeFrom;
      g.lifecycleMode = "FIXED";
    } else {
      g.activeFrom = existingFrom || todayKey;
      // Default fixed window: 30 days (inclusive) => +29 days
      g.activeTo = existingTo || addDaysDateKey(g.activeFrom, 29);
      if (compareDateKeys(g.activeTo, g.activeFrom) < 0) g.activeTo = g.activeFrom;
      if (!normalizeLifecycleMode(g.lifecycleMode)) g.lifecycleMode = "FIXED";
    }

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

    g.outcomeId = g.parentId || null;

    // Completion rules (V3): default ONCE.
    g.completionMode = normalizeCompletionMode(g.completionMode) || "ONCE";
    g.completionTarget = normalizeFloat(g.completionTarget, { min: 1, max: 1000000 });
    g.missPolicy = normalizeMissPolicy(g.missPolicy) || "LENIENT";
    g.graceMinutes = normalizeInt(g.graceMinutes, { min: 0, max: 24 * 60 });

    // Backfill from legacy quantity fields when present (non-breaking)
    if (g.completionMode === "ONCE") {
      const qv = normalizeFloat(g.quantityValue, { min: 1, max: 1000000 });
      if (qv && (typeof g.quantityUnit === "string" && g.quantityUnit.trim())) {
        g.completionMode = "COUNT";
        g.completionTarget = qv;
      }
    }

    // completionTarget required for COUNT/DURATION
    if ((g.completionMode === "COUNT" || g.completionMode === "DURATION") && !g.completionTarget) {
      g.completionTarget = g.completionMode === "DURATION" ? (normalizeFloat(g.durationMinutes, { min: 1, max: 24 * 60 }) || 30) : 1;
    }

    // If ONCE, ignore completionTarget
    if (g.completionMode === "ONCE") g.completionTarget = null;
  }

  // If a PROCESS has no valid parentId, keep it null (linking is optional)
  if (process) {
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
  const shouldHaveProcessSchedule = process && g.planType === "ACTION";
  const shouldKeepOutcomeSchedule = outcome && g.planType === "STATE" && g.schedule && typeof g.schedule === "object";

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
    if (outcome) {
      g.schedule.remindersEnabled = false;
      // NOTE: OUTCOME may keep schedule for planning visibility, but reminders are always forced OFF here.
    }
  } else {
    g.schedule = undefined;
  }

  if (process) {
    const scheduleDays = normalizeDaysOfWeek(g.schedule?.daysOfWeek);
    let repeat = normalizeRepeat(g.repeat);
    if (!repeat) {
      if (g.planType === "ONE_OFF" || normalizeLocalDateKey(g.oneOffDate)) {
        repeat = "none";
      } else if (scheduleDays.length && scheduleDays.length < 7) {
        repeat = "weekly";
      } else {
        repeat = "daily";
      }
    }
    g.repeat = repeat || "none";

    const days = normalizeDaysOfWeek(g.daysOfWeek);
    if (g.repeat === "weekly") {
      g.daysOfWeek = days.length ? days : scheduleDays;
    } else {
      g.daysOfWeek = days.length ? days : [];
    }

    const reminderTime = normalizeStartTime(g.reminderTime);
    const scheduleSlots = Array.isArray(g.schedule?.timeSlots) ? g.schedule.timeSlots : [];
    const scheduleSlot0 = normalizeStartTime(scheduleSlots[0]);
    const startTimeRaw = normalizeStartTime(g.startTime);
    const isLegacyDefaultSlot = scheduleSlots.length === 1 && scheduleSlot0 === "09:00";
    const isAnytime = !startTimeRaw && !reminderTime;
    if (isAnytime && isLegacyDefaultSlot) {
      if (g.schedule && typeof g.schedule === "object") {
        g.schedule.timeSlots = ["00:00"];
      }
      g.startTime = "";
    }

    const startTime = normalizeStartTime(g.startTime);
    const scheduleStart = normalizeStartTime(g.schedule?.timeSlots?.[0]);
    if (startTime) g.startTime = startTime;
    else if (scheduleStart && scheduleStart !== "00:00") g.startTime = scheduleStart;
    else g.startTime = "";

    const timeFields = normalizeTimeFields({
      timeMode: g.timeMode,
      timeSlots: g.timeSlots,
      startTime: g.startTime,
      reminderTime,
    });
    g.timeMode = timeFields.timeMode;
    g.timeSlots = timeFields.timeSlots;
    g.startTime = timeFields.startTime;

    // Advanced scheduling (weekly slots by day)
    let scheduleMode = normalizeScheduleMode(g.scheduleMode) || normalizeScheduleMode(g.schedule?.scheduleMode);
    const weeklySlotsByDay = normalizeWeeklySlotsByDay(g.weeklySlotsByDay) || normalizeWeeklySlotsByDay(g.schedule?.weeklySlotsByDay);

    if (weeklySlotsByDay && !scheduleMode) scheduleMode = "WEEKLY_SLOTS";

    if (scheduleMode === "WEEKLY_SLOTS" && weeklySlotsByDay) {
      g.scheduleMode = "WEEKLY_SLOTS";
      g.weeklySlotsByDay = weeklySlotsByDay;
      if (g.schedule && typeof g.schedule === "object") {
        g.schedule = { ...g.schedule, scheduleMode: "WEEKLY_SLOTS", weeklySlotsByDay };
      }
    } else {
      // Any non-weekly-slots mode: clear payload to avoid stale data.
      if (typeof g.scheduleMode !== "undefined") g.scheduleMode = undefined;
      if (typeof g.weeklySlotsByDay !== "undefined") g.weeklySlotsByDay = undefined;
      if (g.schedule && typeof g.schedule === "object") {
        const sched = { ...g.schedule };
        delete sched.scheduleMode;
        delete sched.weeklySlotsByDay;
        g.schedule = sched;
      }
    }

    // ONE_OFF must never carry weekly-slots payload.
    if (g.planType === "ONE_OFF") {
      g.scheduleMode = undefined;
      g.weeklySlotsByDay = undefined;
      if (g.schedule && typeof g.schedule === "object") {
        const sched = { ...g.schedule };
        delete sched.scheduleMode;
        delete sched.weeklySlotsByDay;
        g.schedule = sched;
      }
    }

    const duration = normalizeDurationMinutes(g.durationMinutes);
    const scheduleDuration = normalizeDurationMinutes(g.schedule?.durationMinutes);
    const sessionDuration = normalizeDurationMinutes(g.sessionMinutes);
    g.durationMinutes = duration ?? scheduleDuration ?? sessionDuration ?? null;
  }

  // OUTCOME goals must not carry completion/miss semantics.
  if (outcome) {
    g.completionMode = undefined;
    g.completionTarget = undefined;
    g.missPolicy = undefined;
    g.graceMinutes = undefined;
  }
  g.resetPolicy = normalizeResetPolicy(g.resetPolicy);

  return g;
}

export { normalizeGoal as normalizeGoalFields };

export function initialData() {
  return {
    schemaVersion: SCHEMA_VERSION,
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
      pageAccents: { home: BRAND_ACCENT },

      // legacy (kept for backward compatibility during migration)
      pageThemeHome: "aurora",
      accentHome: BRAND_ACCENT,

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
    scheduleRules: [],
    sessionHistory: [],
    sessions: [],
    occurrences: [],
    checks: {},
    microChecks: {},
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
    schemaVersion: SCHEMA_VERSION,
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
      pageAccents: { home: BRAND_ACCENT },
      pageThemeHome: "aurora",
      accentHome: BRAND_ACCENT,
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
    scheduleRules: [],
    sessionHistory: [],
    sessions: [],
    checks: {},
    microChecks: {},
  };
}
