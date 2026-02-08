import { uid } from "../../utils/helpers";
import { normalizeGoalsState } from "../goals";
import { normalizeReminder } from "../reminders";
import { normalizeLocalDateKey, toLocalDateKey } from "../../utils/dateKey";
import { resolveGoalType, isOutcome, isProcess } from "../../domain/goalType";
import { findOccurrenceForGoalDateDeterministic, setOccurrenceStatus, upsertOccurrence } from "../occurrences";
import { BLOCKS_SCHEMA_VERSION, getDefaultBlocksByPage } from "../blocks/registry";
import { ensureBlocksConfig } from "../blocks/ensureBlocksConfig";
import { validateBlocksState } from "../blocks/validateBlocksState";
import { buildScheduleRuleSourceKey, buildScheduleRulesFromAction, normalizeScheduleRule } from "../scheduleRules";
import { BRAND_ACCENT } from "../../theme/themeTokens";
import { ensureSystemInboxCategory } from "./inbox";
import { DEFAULT_BLOCKS, ensureCategoryId, initialData, normalizeCategory, normalizeGoal } from "./normalizers";
import {
  SCHEMA_VERSION,
  normalizeCadence,
  cadenceToFreqUnit,
  inferMeasureTypeFromUnit,
  normalizeGoalPriority,
  normalizeDateKeyLoose,
  addDaysDateKey,
  compareDateKeys,
  normalizeLifecycleMode,
  normalizeScheduleMode,
  normalizeWeeklySlotsByDay,
  normalizeStartTime,
} from "./_shared";

export { SCHEMA_VERSION };

function backfillGoalLegacyFields(rawGoal) {
  if (!rawGoal || typeof rawGoal !== "object") return rawGoal;
  const g = { ...rawGoal };
  const rawType = typeof g.type === "string" ? g.type.toUpperCase() : "";
  const rawPlan = typeof g.planType === "string" ? g.planType.toUpperCase() : "";
  const resolvedType = resolveGoalType(g);

  if (!rawType) {
    g.type = resolvedType;
  }

  if (!rawPlan) {
    if (resolvedType === "OUTCOME") g.planType = "STATE";
    else if (resolvedType === "PROCESS") g.planType = g.oneOffDate ? "ONE_OFF" : "ACTION";
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
  h.categoryId = ensureCategoryId(h).categoryId;
  return h;
}

function migrateLegacyChecks(rawChecks) {
  const checks = rawChecks && typeof rawChecks === "object" ? rawChecks : {};
  const nextChecks = {};
  let legacyFound = false;

  for (const [key, bucket] of Object.entries(checks)) {
    const dateKey = normalizeLocalDateKey(key);
    if (dateKey) {
      const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter(Boolean) : [];
      const micro = bucket?.micro && typeof bucket.micro === "object"
        ? { ...bucket.micro }
        : Array.isArray(bucket?.micro)
          ? bucket.micro.reduce((acc, id) => {
              if (typeof id === "string" && id.trim()) acc[id] = true;
              return acc;
            }, {})
          : {};
      if (habits.length || Object.keys(micro).length) {
        nextChecks[dateKey] = { habits: Array.from(new Set(habits)), micro };
      }
      continue;
    }

    if (bucket && typeof bucket === "object" && (bucket.daily || bucket.weekly || bucket.yearly)) {
      legacyFound = true;
      const daily = bucket.daily && typeof bucket.daily === "object" ? bucket.daily : {};
      for (const [dKey, val] of Object.entries(daily)) {
        if (!val) continue;
        const normalized = normalizeLocalDateKey(dKey);
        if (!normalized) continue;
        const entry = nextChecks[normalized] || { habits: [], micro: {} };
        if (!entry.habits.includes(key)) entry.habits.push(key);
        nextChecks[normalized] = entry;
      }
    }
  }

  return legacyFound ? { checks: nextChecks, legacy: checks } : { checks, legacy: null };
}

function normalizeLegacyIdList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const id of list) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function extractStartTime(raw) {
  if (typeof raw !== "string" || !raw.trim()) return "";
  const trimmed = raw.trim();
  if (/^\d{2}:\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

function normalizeLegacySession(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const dateKey = normalizeLocalDateKey(s.dateKey || s.date || "");
  const statusRaw = typeof s.status === "string" ? s.status.toLowerCase() : "";
  const status = statusRaw === "skipped" ? "skipped" : statusRaw === "done" || statusRaw === "partial" ? "done" : "";
  const habitIds = normalizeLegacyIdList(
    Array.isArray(s.habitIds) ? s.habitIds : s.habitId ? [s.habitId] : []
  );
  const doneHabitIds = normalizeLegacyIdList(
    Array.isArray(s.doneHabitIds) ? s.doneHabitIds : s.doneHabits ? s.doneHabits : []
  );
  const start = extractStartTime(s.startAt || s.startedAt || s.timerStartedAt || "");
  const durationMinutes = Number.isFinite(s.duration)
    ? Math.round(s.duration)
    : Number.isFinite(s.durationSec)
      ? Math.round(s.durationSec / 60)
      : null;
  return { dateKey, status, habitIds, doneHabitIds, start, durationMinutes };
}

function migrateLegacyActivity(nextState) {
  if (!nextState || typeof nextState !== "object") {
    return { state: nextState, checksLegacy: null, sessionsLegacy: null };
  }
  const goals = Array.isArray(nextState.goals) ? nextState.goals : [];
  const goalIds = new Set(goals.map((g) => g?.id).filter(Boolean));
  let occurrences = Array.isArray(nextState.occurrences) ? nextState.occurrences : [];
  const microChecks = nextState.microChecks && typeof nextState.microChecks === "object"
    ? { ...nextState.microChecks }
    : {};

  const applyStatus = (goalId, dateKey, status, start, durationMinutes) => {
    if (!goalId || !dateKey || !status) return;
    if (!goalIds.has(goalId)) return;
    const hasAny = occurrences.some((o) => o && o.goalId === goalId && o.date === dateKey);
    const preferredStart = typeof start === "string" ? start : "";

    if (preferredStart) {
      const match = findOccurrenceForGoalDateDeterministic(occurrences, goalId, dateKey, preferredStart);
      if (match && match.start === preferredStart) {
        occurrences = setOccurrenceStatus(goalId, dateKey, preferredStart, status, { occurrences, goals });
        return;
      }
      if (!hasAny) {
        occurrences = upsertOccurrence(
          goalId,
          dateKey,
          preferredStart,
          durationMinutes,
          { status },
          { occurrences, goals }
        );
        return;
      }
      if (match) {
        const fallbackStart = match.start || "00:00";
        occurrences = setOccurrenceStatus(goalId, dateKey, fallbackStart, status, { occurrences, goals });
        return;
      }
      occurrences = upsertOccurrence(
        goalId,
        dateKey,
        preferredStart,
        durationMinutes,
        { status },
        { occurrences, goals }
      );
      return;
    }

    if (hasAny) {
      const match = findOccurrenceForGoalDateDeterministic(occurrences, goalId, dateKey, "");
      if (match) {
        const fallbackStart = match.start || "00:00";
        occurrences = setOccurrenceStatus(goalId, dateKey, fallbackStart, status, { occurrences, goals });
        return;
      }
    }

    occurrences = upsertOccurrence(
      goalId,
      dateKey,
      "00:00",
      durationMinutes,
      { status },
      { occurrences, goals }
    );
  };

  const migratedChecks = migrateLegacyChecks(nextState.checks);
  const normalizedChecks = migratedChecks.checks || {};
  for (const [key, bucket] of Object.entries(normalizedChecks)) {
    const dateKey = normalizeLocalDateKey(key);
    if (!dateKey) continue;
    const habits = Array.isArray(bucket?.habits) ? bucket.habits : [];
    for (const habitId of habits) {
      if (typeof habitId !== "string" || !habitId.trim()) continue;
      applyStatus(habitId.trim(), dateKey, "done", "", null);
    }
    const micro = bucket?.micro && typeof bucket.micro === "object" ? { ...bucket.micro } : {};
    if (Object.keys(micro).length) {
      microChecks[dateKey] = { ...(microChecks[dateKey] || {}), ...micro };
    }
  }

  const sessions = Array.isArray(nextState.sessions) ? nextState.sessions : [];
  for (const raw of sessions) {
    const normalized = normalizeLegacySession(raw);
    if (!normalized.dateKey || !normalized.status) continue;
    const targets =
      normalized.status === "skipped"
        ? normalized.habitIds
        : normalized.doneHabitIds.length
          ? normalized.doneHabitIds
          : normalized.habitIds;
    for (const habitId of targets) {
      applyStatus(habitId, normalized.dateKey, normalized.status, normalized.start, normalized.durationMinutes);
    }
  }

  return {
    state: { ...nextState, occurrences, microChecks },
    checksLegacy: migratedChecks.legacy,
    sessionsLegacy: sessions.length ? sessions : null,
  };
}

function mergeLegacyHabitsIntoGoals(state) {
  if (!state || typeof state !== "object") return state;
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const habits = Array.isArray(state.habits) ? state.habits : [];
  if (!habits.length) return state;

  const existingGoalIds = new Set(goals.map((g) => g?.id).filter(Boolean));
  const existingProcessIds = new Set(
    goals.filter((g) => resolveGoalType(g) === "PROCESS").map((g) => g?.id).filter(Boolean)
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
      if (!isOutcome(parent) || parent?.categoryId !== categoryId) parentId = null;
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
export function migrate(prev) {
  let next = prev && typeof prev === "object" ? { ...prev } : initialData();
  const prevSchemaVersion = Number.isFinite(next.schemaVersion) ? next.schemaVersion : 0;
  if (!Number.isFinite(next.schemaVersion)) next.schemaVersion = 0;

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
    next.ui.selectedCategoryId = null;
  }

  // V2: ensure pageThemes/pageAccents exist (used by utils/_theme)
  if (!next.ui.pageThemes || typeof next.ui.pageThemes !== "object") next.ui.pageThemes = {};
  if (!next.ui.pageAccents || typeof next.ui.pageAccents !== "object") next.ui.pageAccents = {};

  // migrate legacy single-value keys into the V2 objects
  if (!next.ui.pageThemes.home) {
    if (next.ui.pageThemeHome) next.ui.pageThemes.home = next.ui.pageThemeHome;
    else next.ui.pageThemes.home = "aurora";
  }
  if (!next.ui.pageAccents.home || next.ui.pageAccents.home !== BRAND_ACCENT) {
    next.ui.pageAccents.home = BRAND_ACCENT;
  }

  // legacy defaults (kept so old code paths don't crash)
  if (!next.ui.pageThemeHome) next.ui.pageThemeHome = next.ui.pageThemes?.home || "aurora";
  if (!next.ui.accentHome || next.ui.accentHome !== BRAND_ACCENT) {
    next.ui.accentHome = BRAND_ACCENT;
  }

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
  {
    const ensured = ensureSystemInboxCategory(next);
    next = ensured.state || next;
  }

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
  // Safety: enforce mandatory lifecycle period on PROCESS goals after normalizeGoal.
  {
    const todayKey = toLocalDateKey();
    next.goals = next.goals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (!isProcess(g)) return g;

      const planType = typeof g.planType === "string" ? g.planType : "ACTION";
      const from = normalizeDateKeyLoose(g.activeFrom) || "";
      const to = normalizeDateKeyLoose(g.activeTo) || "";

      if (planType === "ONE_OFF") {
        const oneOff = normalizeDateKeyLoose(g.oneOffDate) || from || todayKey;
        return { ...g, lifecycleMode: "FIXED", activeFrom: oneOff, activeTo: oneOff };
      }

      const activeFrom = from || todayKey;
      const activeTo = to || addDaysDateKey(activeFrom, 29);
      const clampedTo = compareDateKeys(activeTo, activeFrom) < 0 ? activeFrom : activeTo;
      const lifecycleMode = normalizeLifecycleMode(g.lifecycleMode) || "FIXED";
      return { ...g, lifecycleMode, activeFrom, activeTo: clampedTo };
    });
  }
  next.goals = next.goals.map((g) => ({
    ...g,
    status: g.status === "abandoned" ? "invalid" : g.status,
  }));

  // --- Semantic cleanup: prevent cross-category / invalid parent links (PROCESS -> OUTCOME only)
  {
    const byId = new Map(next.goals.map((g) => [g.id, g]));
    next.goals = next.goals.map((g) => {
      if (!g || typeof g !== "object") return g;
      if (!isProcess(g)) return g;

      const rawParent = typeof g.parentId === "string" ? g.parentId.trim() : "";
      if (!rawParent) {
        // Ensure both legacy fields are aligned
        return { ...g, parentId: null, primaryGoalId: null };
      }

      const parent = byId.get(rawParent);
      const parentOk = Boolean(parent && isOutcome(parent) && parent.categoryId && parent.categoryId === g.categoryId);

      if (!parentOk) {
        // Do NOT delete the habit; just detach it.
        return { ...g, parentId: null, primaryGoalId: null };
      }

      // Keep both fields consistent
      return { ...g, parentId: parent.id, primaryGoalId: parent.id };
    });
  }

  // Enforce: mainGoalId reflects only the OUTCOME with priority === "prioritaire"
  const prioritaireByCategory = new Map();
  for (const g of next.goals) {
    if (!isOutcome(g)) continue;
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
      if (!isOutcome(g)) return g;
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
    const hasOutcome = next.goals.some((g) => isOutcome(g));
    const hasProcess = next.goals.some((g) => isProcess(g));

    if (step >= 3 && nameOk && whyOk && (hasOutcome || hasProcess)) {
      next.ui.onboardingCompleted = true;
    }
  }

  // habits/checks
  if (!Array.isArray(next.reminders)) next.reminders = [];
  next.reminders = next.reminders.map((r, i) => normalizeReminder(r, i));
  if (!Array.isArray(next.occurrences)) next.occurrences = [];
  if (!next.microChecks || typeof next.microChecks !== "object") next.microChecks = {};

  const migrated = migrateLegacyActivity(next);
  next = migrated.state || next;
  if (migrated.checksLegacy && !next.checksLegacy) {
    next.checksLegacy = migrated.checksLegacy;
  }
  if (migrated.sessionsLegacy && !next.sessionsLegacy) {
    next.sessionsLegacy = migrated.sessionsLegacy;
  }

  // Cleanup: remove legacy timed occurrences/reminders for anytime goals.
  {
    const anytimeGoalIds = new Set();
    for (const g of next.goals || []) {
      if (!g || !isProcess(g)) continue;
      const st = normalizeStartTime(g.startTime);
      const rt = normalizeStartTime(g.reminderTime);
      const sm = normalizeScheduleMode(g.scheduleMode) || normalizeScheduleMode(g.schedule?.scheduleMode);
      const wsd = normalizeWeeklySlotsByDay(g.weeklySlotsByDay) || normalizeWeeklySlotsByDay(g.schedule?.weeklySlotsByDay);
      const hasWeeklySlots = sm === "WEEKLY_SLOTS" && Boolean(wsd);
      if (!st && !rt && g.id && !hasWeeklySlots) anytimeGoalIds.add(g.id);
    }
    if (anytimeGoalIds.size) {
      let removedOccurrences = 0;
      if (Array.isArray(next.occurrences)) {
        const before = next.occurrences.length;
        next.occurrences = next.occurrences.filter((o) => {
          if (!o || !o.goalId) return true;
          if (!anytimeGoalIds.has(o.goalId)) return true;
          return o.start === "00:00";
        });
        removedOccurrences = before - next.occurrences.length;
      }
      let removedReminders = 0;
      if (Array.isArray(next.reminders)) {
        const before = next.reminders.length;
        next.reminders = next.reminders.filter((r) => {
          const gid = typeof r?.goalId === "string" ? r.goalId : "";
          if (!gid || !anytimeGoalIds.has(gid)) return true;
          return false;
        });
        removedReminders = before - next.reminders.length;
      }
      const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
      if (isDev && (removedOccurrences > 0 || removedReminders > 0)) {
        // eslint-disable-next-line no-console
        console.log("[migration] anytime cleanup", {
          goals: Array.from(anytimeGoalIds),
          removedOccurrences,
          removedReminders,
        });
      }
    }
  }

  // Cleanup: prune orphan occurrences/reminders/sessions/checks (goalId not found).
  {
    const goalIds = new Set((next.goals || []).map((g) => g?.id).filter(Boolean));
    let removedOrphanOccurrences = 0;
    if (Array.isArray(next.occurrences)) {
      const before = next.occurrences.length;
      next.occurrences = next.occurrences.filter((o) => o && goalIds.has(o.goalId));
      removedOrphanOccurrences = before - next.occurrences.length;
    }
    let removedOrphanReminders = 0;
    if (Array.isArray(next.reminders)) {
      const before = next.reminders.length;
      next.reminders = next.reminders.filter((r) => r && goalIds.has(r.goalId));
      removedOrphanReminders = before - next.reminders.length;
    }
    let removedOrphanSessions = 0;
    if (Array.isArray(next.sessions)) {
      const before = next.sessions.length;
      next.sessions = next.sessions
        .map((s) => {
          if (!s || typeof s !== "object") return s;
          const habitIds = Array.isArray(s.habitIds) ? s.habitIds.filter((id) => goalIds.has(id)) : [];
          const doneHabitIds = Array.isArray(s.doneHabitIds) ? s.doneHabitIds.filter((id) => goalIds.has(id)) : [];
          return { ...s, habitIds, doneHabitIds };
        })
        .filter((s) => {
          if (!s || typeof s !== "object") return false;
          const hasHabits = Array.isArray(s.habitIds) && s.habitIds.length > 0;
          const hasDone = Array.isArray(s.doneHabitIds) && s.doneHabitIds.length > 0;
          return hasHabits || hasDone;
        });
      removedOrphanSessions = before - next.sessions.length;
    }
    let removedOrphanChecks = 0;
    if (next.checks && typeof next.checks === "object") {
      const nextChecks = {};
      for (const [key, bucket] of Object.entries(next.checks)) {
        const habits = Array.isArray(bucket?.habits) ? bucket.habits.filter((id) => goalIds.has(id)) : [];
        const micro = bucket?.micro && typeof bucket.micro === "object" ? bucket.micro : {};
        if (habits.length || Object.keys(micro).length) {
          nextChecks[key] = { ...bucket, habits, micro };
        } else {
          removedOrphanChecks += 1;
        }
      }
      next.checks = nextChecks;
    }
    const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;
    if (isDev && (removedOrphanOccurrences || removedOrphanReminders || removedOrphanSessions || removedOrphanChecks)) {
      // eslint-disable-next-line no-console
      console.log("[migration] orphan cleanup", {
        removedOrphanOccurrences,
        removedOrphanReminders,
        removedOrphanSessions,
        removedOrphanChecks,
      });
    }
  }
  next.sessions = [];
  next.checks = {};

  if (!Array.isArray(next.scheduleRules)) next.scheduleRules = [];
  if (!Array.isArray(next.sessionHistory)) next.sessionHistory = [];
  {
    const nowIso = new Date().toISOString();
    const existingRaw = Array.isArray(next.scheduleRules) ? next.scheduleRules : [];
    const normalizedRules = [];
    const existingSourceKeys = new Set();

    for (const raw of existingRaw) {
      const normalized = normalizeScheduleRule(raw);
      if (!normalized) continue;
      const sourceKey = normalized.sourceKey || buildScheduleRuleSourceKey(normalized);
      if (!sourceKey) continue;
      const createdAt = normalized.createdAt || nowIso;
      const updatedAt = normalized.updatedAt || createdAt;
      const merged = {
        ...normalized,
        sourceKey,
        createdAt,
        updatedAt,
      };
      normalizedRules.push(merged);
      existingSourceKeys.add(sourceKey);
    }

    const shouldSeed = prevSchemaVersion < SCHEMA_VERSION || normalizedRules.length === 0;
    if (shouldSeed) {
      const actions = Array.isArray(next.goals) ? next.goals : [];
      for (const action of actions) {
        if (!action || !isProcess(action)) continue;
        const desired = buildScheduleRulesFromAction(action);
        for (const rule of desired) {
          const sourceKey = rule.sourceKey || buildScheduleRuleSourceKey(rule);
          if (!sourceKey || existingSourceKeys.has(sourceKey)) continue;
          existingSourceKeys.add(sourceKey);
          normalizedRules.push({
            ...rule,
            id: rule.id || uid(),
            actionId: action.id,
            sourceKey,
            isActive: rule.isActive !== false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
      }
    }

    next.scheduleRules = normalizedRules;
  }

  if (next.schemaVersion < SCHEMA_VERSION) next.schemaVersion = SCHEMA_VERSION;

  const normalized = normalizeGoalsState(next);

  // Defensive re-validation after normalizeGoalsState
  {
    const cats = Array.isArray(normalized.categories) ? normalized.categories : [];
    const goals = Array.isArray(normalized.goals) ? normalized.goals : [];
    const fixedCategories = cats.map((cat) => {
      const outcomes = goals.filter((x) => isOutcome(x) && x.categoryId === cat.id && x.priority === "prioritaire");
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
