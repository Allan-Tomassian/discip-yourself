import { createEmptyCategoryProfilesState, normalizeCategoryProfilesV1 } from "../../domain/categoryProfile";
import { createDefaultUserAiProfile, USER_AI_CATEGORY_META } from "../../domain/userAiProfile";
import { ensureWindowFromScheduleRules } from "../../logic/occurrencePlanner";
import { upsertOccurrence } from "../../logic/occurrences";
import { createDefaultGoalSchedule, normalizeCategory, normalizeGoal } from "../../logic/state";
import {
  addDaysLocal,
  appDowFromDate,
  fromLocalDateKey,
  minutesToTimeStr,
  normalizeLocalDateKey,
  normalizeStartTime,
  parseTimeToMinutes,
  toLocalDateKey,
} from "../../utils/datetime";

const COMMIT_SOURCE = "first_run";
const PLANNING_WINDOW_DAYS = 7;
const ACTION_ACTIVE_DAYS = 30;
const DOW_ALL = Object.freeze([1, 2, 3, 4, 5, 6, 7]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function trimString(value, maxLength = 4000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function hashString(value) {
  const input = String(value || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function deterministicId(kind, commitKey, rawId) {
  return `fr_${kind}_${hashString(`${commitKey}:${rawId || kind}`)}`;
}

function normalizeNameKey(value) {
  return trimString(value, 160)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeIdList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of value) {
    const normalized = trimString(entry, 160);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function makeFailedCommit({ firstRun, selectedPlan, selectedPlanSource, errorCode, nowIso, commitKey = null }) {
  return {
    version: 1,
    status: "failed",
    commitKey,
    selectedPlanId: trimString(selectedPlan?.id, 120) || trimString(firstRun?.selectedPlanId, 120) || null,
    selectedPlanType: trimString(selectedPlan?.variant, 80) || null,
    selectedPlanSource: trimString(selectedPlanSource, 80) || null,
    appliedAt: null,
    createdCategoryIds: [],
    reusedCategoryIds: [],
    createdGoalIds: [],
    createdActionIds: [],
    createdOccurrenceIds: [],
    errorCode: trimString(errorCode, 80) || "COMMIT_FAILED",
    updatedAt: nowIso,
  };
}

function makeAppliedCommit({
  commitKey,
  firstRun,
  selectedPlan,
  selectedPlanSource,
  nowIso,
  createdCategoryIds,
  reusedCategoryIds,
  createdGoalIds,
  createdActionIds,
  createdOccurrenceIds,
}) {
  return {
    version: 1,
    status: "applied",
    commitKey,
    selectedPlanId: trimString(selectedPlan?.id, 120) || trimString(firstRun?.selectedPlanId, 120) || null,
    selectedPlanType: trimString(selectedPlan?.variant, 80) || null,
    selectedPlanSource: trimString(selectedPlanSource, 80) || null,
    appliedAt: nowIso,
    createdCategoryIds: normalizeIdList(createdCategoryIds),
    reusedCategoryIds: normalizeIdList(reusedCategoryIds),
    createdGoalIds: normalizeIdList(createdGoalIds),
    createdActionIds: normalizeIdList(createdActionIds),
    createdOccurrenceIds: normalizeIdList(createdOccurrenceIds),
    errorCode: null,
  };
}

function buildCommitKey({ firstRun, selectedPlan, selectedPlanSource }) {
  const payload = {
    inputHash: firstRun?.inputHash || firstRun?.generatedPlans?.inputHash || null,
    selectedPlanId: selectedPlan?.id || firstRun?.selectedPlanId || null,
    selectedPlanSource: selectedPlanSource || null,
    commitDraft: selectedPlan?.commitDraft || null,
  };
  return `frc_${hashString(stableSerialize(payload))}`;
}

function validateCommitDraft(commitDraft) {
  if (!isPlainObject(commitDraft)) return "MISSING_COMMIT_DRAFT";
  if (!Array.isArray(commitDraft.categories) || !commitDraft.categories.some((entry) => trimString(entry?.name, 96))) {
    return "MISSING_COMMIT_CATEGORY";
  }
  if (!Array.isArray(commitDraft.goals) || !commitDraft.goals.some((entry) => trimString(entry?.title, 160))) {
    return "MISSING_COMMIT_GOAL";
  }
  if (!Array.isArray(commitDraft.actions) || !commitDraft.actions.some((entry) => trimString(entry?.title, 160))) {
    return "MISSING_COMMIT_ACTION";
  }
  return null;
}

function containsAllIds(items, ids) {
  if (!ids.length) return false;
  const existingIds = new Set((Array.isArray(items) ? items : []).map((item) => item?.id).filter(Boolean));
  return ids.every((id) => existingIds.has(id));
}

function canReuseAppliedCommit(state, commitV1, commitKey) {
  if (!commitV1 || commitV1.status !== "applied" || commitV1.commitKey !== commitKey) return false;
  const categoryIds = normalizeIdList([...(commitV1.createdCategoryIds || []), ...(commitV1.reusedCategoryIds || [])]);
  if (!containsAllIds(state.categories, categoryIds)) return false;
  if (!containsAllIds(state.goals, normalizeIdList(commitV1.createdGoalIds))) return false;
  if (!containsAllIds(state.goals, normalizeIdList(commitV1.createdActionIds))) return false;
  if (!containsAllIds(state.occurrences, normalizeIdList(commitV1.createdOccurrenceIds))) return false;
  return true;
}

function resolveTodayKey(now) {
  return normalizeLocalDateKey(now) || toLocalDateKey(now instanceof Date ? now : new Date()) || "";
}

function resolveDow(dateKey) {
  const dow = appDowFromDate(fromLocalDateKey(dateKey));
  return Number.isInteger(dow) ? dow : 1;
}

function resolveActionDays(action, todayKey) {
  const repeat = trimString(action?.repeat, 32).toLowerCase();
  if (repeat === "daily") return DOW_ALL.slice();
  const days = Array.isArray(action?.daysOfWeek) ? action.daysOfWeek.filter((day) => DOW_ALL.includes(day)) : [];
  return days.length ? days : [resolveDow(todayKey)];
}

function normalizeDuration(value, fallback = 25) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  return rounded > 0 ? rounded : fallback;
}

function resolveActionStart(action) {
  const start = normalizeStartTime(action?.startTime);
  if (start) return start;
  const firstSlot = Array.isArray(action?.timeSlots) ? normalizeStartTime(action.timeSlots[0]) : "";
  return firstSlot || "";
}

function addMinutes(dateKey, start, durationMinutes) {
  const startMinutes = parseTimeToMinutes(start);
  if (!Number.isFinite(startMinutes)) return "";
  const endTime = minutesToTimeStr(startMinutes + normalizeDuration(durationMinutes, 0));
  return endTime ? `${dateKey}T${endTime}` : "";
}

function buildScheduleForAction(action, todayKey, durationMinutes, startTime, daysOfWeek) {
  const schedule = createDefaultGoalSchedule();
  return {
    ...schedule,
    daysOfWeek,
    timeSlots: startTime ? [startTime] : [],
    durationMinutes,
    remindersEnabled: false,
    timezone: schedule.timezone || "Europe/Paris",
  };
}

function buildProcessGoal({ action, id, categoryId, parentId, todayKey, nowIso, commitKey, selectedPlan }) {
  const startTime = resolveActionStart(action);
  const durationMinutes = normalizeDuration(action.durationMinutes || action.sessionMinutes, 25);
  const daysOfWeek = resolveActionDays(action, todayKey);
  const timeMode = action.timeMode === "FIXED" && startTime ? "FIXED" : "NONE";
  return normalizeGoal(
    {
      id,
      categoryId,
      parentId: parentId || null,
      outcomeId: parentId || null,
      title: trimString(action.title, 160),
      type: "PROCESS",
      kind: "ACTION",
      planType: "ACTION",
      status: "active",
      repeat: daysOfWeek.length === 7 ? "daily" : "weekly",
      daysOfWeek,
      timeMode,
      timeSlots: startTime ? [startTime] : [],
      startTime,
      durationMinutes,
      sessionMinutes: normalizeDuration(action.sessionMinutes || durationMinutes, durationMinutes),
      activeFrom: todayKey,
      activeTo: addDaysLocal(todayKey, ACTION_ACTIVE_DAYS - 1),
      schedule: buildScheduleForAction(action, todayKey, durationMinutes, startTime, daysOfWeek),
      createdAt: nowIso,
      updatedAt: nowIso,
      source: COMMIT_SOURCE,
      firstRunCommitKey: commitKey,
      firstRunPlanId: selectedPlan?.id || null,
    },
    Number.isFinite(action.order) ? action.order : 0
  );
}

function buildOutcomeGoal({ goal, id, categoryId, todayKey, nowIso, commitKey, selectedPlan }) {
  return normalizeGoal(
    {
      id,
      categoryId,
      title: trimString(goal.title, 160),
      type: "OUTCOME",
      kind: "OUTCOME",
      planType: "STATE",
      status: "active",
      startDate: todayKey,
      createdAt: nowIso,
      updatedAt: nowIso,
      source: COMMIT_SOURCE,
      firstRunCommitKey: commitKey,
      firstRunPlanId: selectedPlan?.id || null,
    },
    Number.isFinite(goal.order) ? goal.order : 0
  );
}

function patchFirstRunOccurrences({ state, actionIds, commitKey, selectedPlan, fromKey, toKey, beforeOccurrenceIds }) {
  const actionSet = new Set(actionIds);
  const beforeSet = new Set(beforeOccurrenceIds);
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  const nextOccurrences = occurrences.map((occ) => {
    if (!occ || !actionSet.has(occ.goalId)) return occ;
    const date = normalizeLocalDateKey(occ.date);
    if (!date || date < fromKey || date > toKey) return occ;
    return {
      ...occ,
      source: occ.source || COMMIT_SOURCE,
      firstRunCommitKey: occ.firstRunCommitKey || commitKey,
      firstRunPlanId: occ.firstRunPlanId || selectedPlan?.id || null,
    };
  });
  return {
    nextState: nextOccurrences === occurrences ? state : { ...state, occurrences: nextOccurrences },
    createdOccurrenceIds: nextOccurrences
      .filter((occ) => occ && actionSet.has(occ.goalId) && !beforeSet.has(occ.id))
      .map((occ) => occ.id)
      .filter(Boolean),
  };
}

function upsertPlannedOccurrence({ state, actionId, occurrenceId, date, start, durationMinutes, commitKey, selectedPlan }) {
  const safeStart = normalizeStartTime(start) || "00:00";
  const safeDate = normalizeLocalDateKey(date);
  if (!actionId || !safeDate) return state;
  const fixed = safeStart !== "00:00";
  const patch = {
    id: occurrenceId,
    status: "planned",
    durationMinutes: normalizeDuration(durationMinutes, 25),
    source: COMMIT_SOURCE,
    firstRunCommitKey: commitKey,
    firstRunPlanId: selectedPlan?.id || null,
    timeType: fixed ? "fixed" : "window",
  };
  if (fixed) {
    patch.startAt = `${safeDate}T${safeStart}`;
    patch.endAt = addMinutes(safeDate, safeStart, patch.durationMinutes);
    patch.noTime = false;
  } else {
    patch.noTime = true;
    patch.windowStartAt = `${safeDate}T00:00`;
    patch.windowEndAt = `${safeDate}T23:59`;
  }
  return {
    ...state,
    occurrences: upsertOccurrence(actionId, safeDate, safeStart, patch.durationMinutes, patch, state),
  };
}

function applyExplicitOccurrences({ state, commitDraft, actionIdByDraftId, actionById, todayKey, commitKey, selectedPlan }) {
  let nextState = state;
  const occurrences = Array.isArray(commitDraft.occurrences) ? commitDraft.occurrences : [];
  for (const occurrence of occurrences) {
    const mappedActionId = actionIdByDraftId.get(occurrence.actionId);
    if (!mappedActionId) continue;
    const action = actionById.get(mappedActionId) || null;
    const originalDate = normalizeLocalDateKey(occurrence.date);
    const date = !originalDate || originalDate < todayKey ? todayKey : originalDate;
    const start = normalizeStartTime(occurrence.start) || resolveActionStart(action) || "00:00";
    const duration = normalizeDuration(occurrence.durationMinutes || action?.durationMinutes || action?.sessionMinutes, 25);
    nextState = upsertPlannedOccurrence({
      state: nextState,
      actionId: mappedActionId,
      occurrenceId: deterministicId("occ", commitKey, occurrence.id || `${mappedActionId}:${date}:${start}`),
      date,
      start,
      durationMinutes: duration,
      commitKey,
      selectedPlan,
    });
  }
  return nextState;
}

function hasPlannedTodayOccurrence(state, actionIds, todayKey) {
  const actionSet = new Set(actionIds);
  return (Array.isArray(state.occurrences) ? state.occurrences : []).some((occ) => {
    if (!occ || !actionSet.has(occ.goalId)) return false;
    if (normalizeLocalDateKey(occ.date) !== todayKey) return false;
    const status = trimString(occ.status, 40).toLowerCase();
    return !status || status === "planned" || status === "postponed" || status === "rescheduled";
  });
}

function guaranteeTodayOccurrence({ state, actionIds, actionById, todayKey, commitKey, selectedPlan }) {
  if (!actionIds.length || hasPlannedTodayOccurrence(state, actionIds, todayKey)) return state;
  const actionId = actionIds[0];
  const action = actionById.get(actionId) || null;
  return upsertPlannedOccurrence({
    state,
    actionId,
    occurrenceId: deterministicId("occ", commitKey, `${actionId}:today`),
    date: todayKey,
    start: "00:00",
    durationMinutes: normalizeDuration(action?.durationMinutes || action?.sessionMinutes, 25),
    commitKey,
    selectedPlan,
  });
}

function keepFirstRunTodayExecutable({ state, actionIds, todayKey }) {
  const actionSet = new Set(actionIds);
  const occurrences = Array.isArray(state.occurrences) ? state.occurrences : [];
  let changed = false;
  const nextOccurrences = occurrences.map((occ) => {
    if (!occ || !actionSet.has(occ.goalId) || normalizeLocalDateKey(occ.date) !== todayKey) return occ;
    if (trimString(occ.status, 40).toLowerCase() !== "missed") return occ;
    changed = true;
    return {
      ...occ,
      status: "planned",
      start: "00:00",
      slotKey: "00:00",
      timeType: "window",
      noTime: true,
      startAt: undefined,
      endAt: undefined,
      windowStartAt: `${todayKey}T00:00`,
      windowEndAt: `${todayKey}T23:59`,
    };
  });
  return changed ? { ...state, occurrences: nextOccurrences } : state;
}

function resolveUserAiGoals(firstRun, commitDraft) {
  const fromDraft = Array.isArray(firstRun?.draftAnswers?.priorityCategoryIds) ? firstRun.draftAnswers.priorityCategoryIds : [];
  const fromCategories = Array.isArray(commitDraft.categories)
    ? commitDraft.categories.map((category) => trimString(category.templateId, 80)).filter(Boolean)
    : [];
  const out = [];
  for (const value of [...fromDraft, ...fromCategories]) {
    if (!USER_AI_CATEGORY_META[value] || out.includes(value)) continue;
    out.push(value);
    if (out.length >= 3) break;
  }
  return out;
}

function resolveTimeBlockFromWindow(windowValue) {
  const start = normalizeStartTime(windowValue?.startTime);
  const minutes = parseTimeToMinutes(start);
  if (!Number.isFinite(minutes)) return "";
  if (minutes < 12 * 60) return "morning";
  if (minutes < 18 * 60) return "afternoon";
  return "evening";
}

function buildUserAiProfileContext(existingProfile, firstRun, commitDraft, nowIso) {
  const existing = createDefaultUserAiProfile(existingProfile);
  const goals = resolveUserAiGoals(firstRun, commitDraft);
  const mergedGoals = [...goals, ...existing.goals].filter((goal, index, list) => goal && list.indexOf(goal) === index).slice(0, 3);
  const hasExistingGoals = existing.goals.length > 0;
  if (hasExistingGoals) {
    return createDefaultUserAiProfile({
      ...existing,
      goals: mergedGoals,
      updated_at: nowIso,
    });
  }

  const capacity = firstRun?.draftAnswers?.currentCapacity;
  const preferredBlocks = (Array.isArray(firstRun?.draftAnswers?.preferredWindows) ? firstRun.draftAnswers.preferredWindows : [])
    .map((windowValue) => resolveTimeBlockFromWindow(windowValue))
    .filter(Boolean);

  return createDefaultUserAiProfile({
    ...existing,
    goals: mergedGoals,
    time_budget_daily_min: capacity === "reprise" ? 30 : capacity === "forte" ? 90 : 60,
    intensity_preference: capacity === "reprise" ? "light" : capacity === "forte" ? "intense" : "balanced",
    preferred_time_blocks: preferredBlocks.length ? preferredBlocks : ["morning"],
    structure_preference: preferredBlocks.length ? "structured" : "simple",
    created_at: existing.created_at || nowIso,
    updated_at: nowIso,
  });
}

function buildConstraints(firstRun) {
  const windows = Array.isArray(firstRun?.draftAnswers?.unavailableWindows) ? firstRun.draftAnswers.unavailableWindows : [];
  return windows
    .map((windowValue) => {
      const label = trimString(windowValue?.label, 80);
      const start = normalizeStartTime(windowValue?.startTime);
      const end = normalizeStartTime(windowValue?.endTime);
      return label || (start && end ? `${start}-${end}` : "");
    })
    .filter(Boolean)
    .slice(0, 5);
}

function applyCategoryProfileContext({ state, categoryIds, goalByCategoryId, actionByCategoryId, firstRun, nowIso }) {
  const existingProfiles = normalizeCategoryProfilesV1(state.category_profiles_v1 || createEmptyCategoryProfilesState(), state.categories);
  const byCategoryId = { ...(existingProfiles.byCategoryId || {}) };
  const categories = Array.isArray(state.categories) ? state.categories : [];
  const constraints = buildConstraints(firstRun);

  for (const categoryId of categoryIds) {
    const category = categories.find((entry) => entry?.id === categoryId) || null;
    if (!category) continue;
    const current = byCategoryId[categoryId] || { categoryId };
    byCategoryId[categoryId] = {
      ...current,
      categoryId,
      subject: current.subject || category.name || null,
      mainGoal: current.mainGoal || goalByCategoryId.get(categoryId)?.title || null,
      currentPriority: current.currentPriority || actionByCategoryId.get(categoryId)?.title || null,
      constraints: Array.isArray(current.constraints) && current.constraints.length ? current.constraints : constraints,
      updatedAt: current.updatedAt || nowIso,
    };
  }

  return {
    ...state,
    category_profiles_v1: normalizeCategoryProfilesV1({ version: 1, byCategoryId }, categories),
  };
}

function applyUiDefaults({ state, firstCategoryId, todayKey, commitV1 }) {
  const ui = isPlainObject(state.ui) ? state.ui : {};
  const byView = isPlainObject(ui.selectedCategoryByView) ? ui.selectedCategoryByView : {};
  const selectedCategoryByView = {
    ...byView,
    today: byView.today || firstCategoryId || null,
    home: byView.home || firstCategoryId || null,
    planning: byView.planning || firstCategoryId || null,
    library: byView.library || firstCategoryId || null,
    plan: byView.plan || firstCategoryId || null,
    pilotage: byView.pilotage || firstCategoryId || null,
  };

  return {
    ...state,
    ui: {
      ...ui,
      firstRunV1: {
        ...(isPlainObject(ui.firstRunV1) ? ui.firstRunV1 : {}),
        commitV1,
      },
      selectedCategoryId: ui.selectedCategoryId || firstCategoryId || null,
      selectedCategoryByView,
      selectedDate: normalizeLocalDateKey(ui.selectedDate) || todayKey,
      showPlanStep: false,
    },
  };
}

export function applyFirstRunCommitDraft({ state, firstRun, selectedPlan, now = new Date() }) {
  const safeState = isPlainObject(state) ? state : {};
  const safeFirstRun = isPlainObject(firstRun) ? firstRun : {};
  const nowDate = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const nowIso = nowDate.toISOString();
  const todayKey = resolveTodayKey(nowDate);
  const selectedPlanSource = safeFirstRun.generatedPlans?.source || selectedPlan?.source || null;
  const commitDraft = selectedPlan?.commitDraft;
  const commitKey = buildCommitKey({ firstRun: safeFirstRun, selectedPlan, selectedPlanSource });
  const validationError = validateCommitDraft(commitDraft);

  if (!selectedPlan) {
    const commitV1 = makeFailedCommit({ firstRun: safeFirstRun, selectedPlan, selectedPlanSource, errorCode: "MISSING_SELECTED_PLAN", nowIso });
    return { ok: false, nextState: safeState, commitV1, errorCode: commitV1.errorCode };
  }
  if (validationError) {
    const commitV1 = makeFailedCommit({ firstRun: safeFirstRun, selectedPlan, selectedPlanSource, errorCode: validationError, nowIso, commitKey });
    return { ok: false, nextState: safeState, commitV1, errorCode: validationError };
  }

  if (canReuseAppliedCommit(safeState, safeFirstRun.commitV1, commitKey)) {
    const committedCategoryIds = normalizeIdList([
      ...(safeFirstRun.commitV1.createdCategoryIds || []),
      ...(safeFirstRun.commitV1.reusedCategoryIds || []),
    ]);
    const nextState = applyUiDefaults({
      state: safeState,
      firstCategoryId: committedCategoryIds[0] || null,
      todayKey,
      commitV1: safeFirstRun.commitV1,
    });
    return {
      ok: true,
      nextState,
      commitV1: safeFirstRun.commitV1,
      createdCategoryIds: safeFirstRun.commitV1.createdCategoryIds,
      reusedCategoryIds: safeFirstRun.commitV1.reusedCategoryIds,
      createdGoalIds: safeFirstRun.commitV1.createdGoalIds,
      createdActionIds: safeFirstRun.commitV1.createdActionIds,
      createdOccurrenceIds: safeFirstRun.commitV1.createdOccurrenceIds,
      errorCode: null,
    };
  }

  const existingCategories = Array.isArray(safeState.categories) ? safeState.categories.slice() : [];
  const existingGoals = Array.isArray(safeState.goals) ? safeState.goals.slice() : [];
  const existingOccurrenceIds = new Set((Array.isArray(safeState.occurrences) ? safeState.occurrences : []).map((occ) => occ?.id).filter(Boolean));
  const categoryByName = new Map();
  existingCategories.forEach((category) => {
    const key = normalizeNameKey(category?.name);
    if (key && !categoryByName.has(key)) categoryByName.set(key, category);
  });

  const categoryIdByDraftId = new Map();
  const createdCategoryIds = [];
  const reusedCategoryIds = [];
  const nextCategories = existingCategories.slice();

  commitDraft.categories.forEach((draftCategory, index) => {
    const name = trimString(draftCategory.name, 96);
    if (!name) return;
    const key = normalizeNameKey(name);
    const existing = categoryByName.get(key);
    if (existing?.id) {
      categoryIdByDraftId.set(draftCategory.id, existing.id);
      reusedCategoryIds.push(existing.id);
      return;
    }
    const category = normalizeCategory(
      {
        id: deterministicId("cat", commitKey, draftCategory.id || name),
        name,
        color: draftCategory.color,
        templateId: draftCategory.templateId || null,
        order: Number.isFinite(draftCategory.order) ? draftCategory.order : index,
        createdAt: nowIso,
        source: COMMIT_SOURCE,
        firstRunCommitKey: commitKey,
        firstRunPlanId: selectedPlan.id,
      },
      nextCategories.length
    );
    nextCategories.push(category);
    categoryByName.set(key, category);
    categoryIdByDraftId.set(draftCategory.id, category.id);
    createdCategoryIds.push(category.id);
  });

  let nextState = {
    ...safeState,
    categories: nextCategories,
    goals: existingGoals.slice(),
    occurrences: Array.isArray(safeState.occurrences) ? safeState.occurrences.slice() : [],
    profile: isPlainObject(safeState.profile) ? { ...safeState.profile } : {},
  };

  const goalIdByDraftId = new Map();
  const createdGoalIds = [];
  const goalByCategoryId = new Map();
  commitDraft.goals.forEach((draftGoal) => {
    const categoryId = categoryIdByDraftId.get(draftGoal.categoryId);
    const title = trimString(draftGoal.title, 160);
    if (!categoryId || !title) return;
    const goalId = deterministicId("goal", commitKey, draftGoal.id || title);
    goalIdByDraftId.set(draftGoal.id, goalId);
    const existing = nextState.goals.find((goal) => goal?.id === goalId);
    if (existing) {
      goalByCategoryId.set(categoryId, existing);
      return;
    }
    const goal = buildOutcomeGoal({ goal: draftGoal, id: goalId, categoryId, todayKey, nowIso, commitKey, selectedPlan });
    nextState.goals = [...nextState.goals, goal];
    goalByCategoryId.set(categoryId, goal);
    createdGoalIds.push(goalId);
  });

  const actionIdByDraftId = new Map();
  const actionById = new Map();
  const actionByCategoryId = new Map();
  const createdActionIds = [];
  commitDraft.actions.forEach((draftAction) => {
    const categoryId = categoryIdByDraftId.get(draftAction.categoryId);
    const title = trimString(draftAction.title, 160);
    if (!categoryId || !title) return;
    const actionId = deterministicId("action", commitKey, draftAction.id || title);
    const parentId = goalIdByDraftId.get(draftAction.parentGoalId) || goalByCategoryId.get(categoryId)?.id || null;
    actionIdByDraftId.set(draftAction.id, actionId);
    const existing = nextState.goals.find((goal) => goal?.id === actionId);
    if (existing) {
      actionById.set(actionId, existing);
      if (!actionByCategoryId.has(categoryId)) actionByCategoryId.set(categoryId, existing);
      return;
    }
    const action = buildProcessGoal({ action: draftAction, id: actionId, categoryId, parentId, todayKey, nowIso, commitKey, selectedPlan });
    nextState.goals = [...nextState.goals, action];
    actionById.set(actionId, action);
    if (!actionByCategoryId.has(categoryId)) actionByCategoryId.set(categoryId, action);
    createdActionIds.push(actionId);
  });

  nextState.categories = nextState.categories.map((category) => {
    if (!category || category.mainGoalId) return category;
    const goal = goalByCategoryId.get(category.id);
    return goal ? { ...category, mainGoalId: goal.id } : category;
  });

  nextState = applyExplicitOccurrences({
    state: nextState,
    commitDraft,
    actionIdByDraftId,
    actionById,
    todayKey,
    commitKey,
    selectedPlan,
  });

  const actionIds = Array.from(actionById.keys());
  const toKey = addDaysLocal(todayKey, PLANNING_WINDOW_DAYS - 1);
  nextState = ensureWindowFromScheduleRules(nextState, todayKey, toKey, actionIds, nowDate);
  nextState = keepFirstRunTodayExecutable({ state: nextState, actionIds, todayKey });
  nextState = guaranteeTodayOccurrence({ state: nextState, actionIds, actionById, todayKey, commitKey, selectedPlan });

  const patched = patchFirstRunOccurrences({
    state: nextState,
    actionIds,
    commitKey,
    selectedPlan,
    fromKey: todayKey,
    toKey,
    beforeOccurrenceIds: Array.from(existingOccurrenceIds),
  });
  nextState = patched.nextState;

  const whyText = trimString(safeFirstRun.draftAnswers?.whyText, 1200);
  if (whyText && !trimString(nextState.profile?.whyText, 1200)) {
    nextState.profile = {
      ...nextState.profile,
      whyText,
      whyUpdatedAt: nowIso,
    };
  }

  nextState = {
    ...nextState,
    user_ai_profile: buildUserAiProfileContext(nextState.user_ai_profile, safeFirstRun, commitDraft, nowIso),
  };

  const committedCategoryIds = normalizeIdList([...createdCategoryIds, ...reusedCategoryIds]);
  nextState = applyCategoryProfileContext({
    state: nextState,
    categoryIds: committedCategoryIds,
    goalByCategoryId,
    actionByCategoryId,
    firstRun: safeFirstRun,
    nowIso,
  });

  const createdOccurrenceIds = patched.createdOccurrenceIds;
  const commitV1 = makeAppliedCommit({
    commitKey,
    firstRun: safeFirstRun,
    selectedPlan,
    selectedPlanSource,
    nowIso,
    createdCategoryIds,
    reusedCategoryIds,
    createdGoalIds,
    createdActionIds,
    createdOccurrenceIds,
  });

  nextState = applyUiDefaults({
    state: nextState,
    firstCategoryId: committedCategoryIds[0] || null,
    todayKey,
    commitV1,
  });

  return {
    ok: true,
    nextState,
    commitV1,
    createdCategoryIds: commitV1.createdCategoryIds,
    reusedCategoryIds: commitV1.reusedCategoryIds,
    createdGoalIds: commitV1.createdGoalIds,
    createdActionIds: commitV1.createdActionIds,
    createdOccurrenceIds: commitV1.createdOccurrenceIds,
    errorCode: null,
  };
}
