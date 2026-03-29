import { normalizeRouteOrigin } from "../app/routeOrigin";
import { uid } from "../utils/helpers";
import { normalizeLocalDateKey, todayLocalKey } from "../utils/dateKey";
import { addDaysLocal, normalizeStartTime } from "../utils/datetime";
import { createActionModel, updateActionModel } from "../domain/actionModel";
import { createGoal, updateGoal } from "./goals";
import { updateOccurrence } from "./occurrences";
import { getFirstVisibleCategoryId, resolveVisibleCategoryId } from "../domain/categoryVisibility";
import { createDefaultGoalSchedule } from "./state";
import { ensureWindowFromScheduleRules, regenerateWindowFromScheduleRules } from "./occurrencePlanner";

function normalizeRepeat(value) {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (raw === "none" || raw === "daily" || raw === "weekly") return raw;
  return "";
}

function normalizeDaysOfWeek(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const rawDay of value) {
    const day = Number(rawDay);
    if (!Number.isInteger(day) || day < 1 || day > 7 || seen.has(day)) continue;
    seen.add(day);
    out.push(day);
  }
  return out;
}

function normalizeDuration(value) {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return Math.max(1, Math.round(raw));
}

function buildActionSchedulingPatch(change, existing = null) {
  const repeat = normalizeRepeat(change?.repeat) || (existing?.repeat || "");
  const daysOfWeek = normalizeDaysOfWeek(change?.daysOfWeek);
  const startTime = normalizeStartTime(change?.startTime);
  const durationMinutes = normalizeDuration(change?.durationMin) ?? existing?.durationMinutes ?? null;
  const oneOffDate = normalizeLocalDateKey(change?.dateKey);

  if (repeat === "none" || oneOffDate) {
    const effectiveDate = oneOffDate || normalizeLocalDateKey(existing?.oneOffDate) || todayLocalKey();
    return {
      planType: "ONE_OFF",
      repeat: "none",
      daysOfWeek: [],
      oneOffDate: effectiveDate,
      startAt: startTime ? `${effectiveDate}T${startTime}` : null,
      timeMode: startTime ? "FIXED" : "NONE",
      timeSlots: startTime ? [startTime] : [],
      startTime,
      durationMinutes,
      schedule: undefined,
      cadence: undefined,
      target: undefined,
      freqCount: undefined,
      freqUnit: undefined,
    };
  }

  const normalizedRepeat = repeat || (daysOfWeek.length ? "weekly" : "daily");
  const scheduleDays =
    normalizedRepeat === "weekly" && daysOfWeek.length ? daysOfWeek : [1, 2, 3, 4, 5, 6, 7];
  const schedule = {
    ...createDefaultGoalSchedule(),
    daysOfWeek: scheduleDays,
    timeSlots: startTime ? [startTime] : [],
    durationMinutes,
    remindersEnabled: false,
  };

  return {
    planType: "ACTION",
    repeat: normalizedRepeat,
    daysOfWeek: normalizedRepeat === "weekly" ? scheduleDays : [],
    oneOffDate: undefined,
    startAt: null,
    timeMode: startTime ? "FIXED" : "NONE",
    timeSlots: startTime ? [startTime] : [],
    startTime,
    durationMinutes,
    cadence: normalizedRepeat === "daily" ? "DAILY" : "WEEKLY",
    target: 1,
    freqCount: 1,
    freqUnit: normalizedRepeat === "daily" ? "DAY" : "WEEK",
    schedule,
  };
}

function hasSchedulingFields(change) {
  if (!change || typeof change !== "object") return false;
  return (
    change.repeat != null ||
    change.dateKey != null ||
    change.startTime != null ||
    change.durationMin != null ||
    (Array.isArray(change.daysOfWeek) && change.daysOfWeek.length > 0)
  );
}

function resolveWindowRange(change) {
  const specificDate = normalizeLocalDateKey(change?.dateKey);
  if (specificDate) return { fromKey: specificDate, toKey: specificDate };
  const fromKey = todayLocalKey();
  return { fromKey, toKey: addDaysLocal(fromKey, 13) };
}

export function buildCreationProposalFromDraftChanges(
  state,
  draftChanges,
  { sourceContext = null } = {}
) {
  const safeState = state && typeof state === "object" ? state : {};
  const changes = Array.isArray(draftChanges) ? draftChanges.filter(Boolean) : [];
  const createChanges = changes.filter((change) => String(change?.type || "") === "create_action");
  if (!createChanges.length) return null;

  const categoryFallback = getFirstVisibleCategoryId(safeState.categories);
  const actionDrafts = createChanges.map((change) => {
    const categoryId =
      resolveVisibleCategoryId(change?.categoryId, safeState.categories) ||
      categoryFallback ||
      null;
    const repeat = normalizeRepeat(change?.repeat) || (change?.dateKey ? "none" : "weekly");
    const dateKey = normalizeLocalDateKey(change?.dateKey);
    const startTime = normalizeStartTime(change?.startTime);
    const durationMinutes = normalizeDuration(change?.durationMin);
    const daysOfWeek = normalizeDaysOfWeek(change?.daysOfWeek);
    return {
      title: typeof change?.title === "string" ? change.title.trim() : "",
      categoryId,
      repeat: repeat || "none",
      oneOffDate: repeat === "none" ? dateKey || todayLocalKey() : "",
      daysOfWeek: repeat === "weekly" ? daysOfWeek : [],
      timeMode: startTime ? "FIXED" : "NONE",
      startTime,
      timeSlots: startTime ? [startTime] : [],
      durationMinutes,
    };
  });

  const unresolvedQuestions = [];
  if (actionDrafts.some((draft) => !draft.categoryId)) {
    unresolvedQuestions.push("Choisir la catégorie qui doit accueillir cette création.");
  }
  if (actionDrafts.some((draft) => !draft.title)) {
    unresolvedQuestions.push("Confirmer le titre de l’action avant création.");
  }

  return {
    kind: "assistant",
    categoryDraft: actionDrafts[0]?.categoryId ? { mode: "existing", id: actionDrafts[0].categoryId } : { mode: "unresolved" },
    actionDrafts,
    unresolvedQuestions,
    sourceContext: normalizeRouteOrigin(sourceContext),
    requiresValidation: true,
  };
}

export function applyChatDraftChanges(state, draftChanges) {
  const safeState = state && typeof state === "object" ? state : {};
  const changes = Array.isArray(draftChanges) ? draftChanges.filter(Boolean) : [];
  let nextState = safeState;
  let appliedCount = 0;
  let needsPlanningReview = false;

  for (const change of changes) {
    const type = typeof change?.type === "string" ? change.type : "";
    if (!type) continue;

    if (type === "create_action") {
      continue;
    }

    if (type === "update_action" || type === "schedule_action") {
      const actionId = typeof change?.actionId === "string" ? change.actionId : "";
      const existing = Array.isArray(nextState.goals)
        ? nextState.goals.find((goal) => goal?.id === actionId) || null
        : null;
      if (!existing) continue;
      const schedulingPatch =
        type === "schedule_action" || hasSchedulingFields(change)
          ? buildActionSchedulingPatch(change, existing)
          : {};
      const candidate = updateActionModel(
        existing,
        {
          ...(change?.title ? { title: change.title } : {}),
          ...(change?.categoryId ? { categoryId: change.categoryId } : {}),
          ...schedulingPatch,
        },
        { categories: nextState.categories }
      );
      if (!candidate.ok || !candidate.value) continue;
      nextState = updateGoal(nextState, actionId, candidate.value);
      const range = resolveWindowRange(change);
      if (type === "schedule_action" || hasSchedulingFields(change)) {
        nextState = regenerateWindowFromScheduleRules(nextState, actionId, range.fromKey, range.toKey);
      }
      appliedCount += 1;
      if (type === "schedule_action" || hasSchedulingFields(change)) needsPlanningReview = true;
      continue;
    }

    if (type === "reschedule_occurrence") {
      const occurrenceId = typeof change?.occurrenceId === "string" ? change.occurrenceId : "";
      if (!occurrenceId) continue;
      const dateKey = normalizeLocalDateKey(change?.dateKey);
      const startTime = normalizeStartTime(change?.startTime);
      const durationMinutes = normalizeDuration(change?.durationMin);
      const nextOccurrences = updateOccurrence(
        occurrenceId,
        {
          ...(dateKey ? { date: dateKey } : {}),
          ...(startTime ? { start: startTime, slotKey: startTime } : {}),
          ...(durationMinutes ? { durationMinutes } : {}),
          status: "planned",
        },
        nextState
      );
      if (nextOccurrences === nextState.occurrences) continue;
      nextState = { ...nextState, occurrences: nextOccurrences };
      appliedCount += 1;
      needsPlanningReview = true;
      continue;
    }

    if (type === "archive_action") {
      const actionId = typeof change?.actionId === "string" ? change.actionId : "";
      if (!actionId) continue;
      nextState = updateGoal(nextState, actionId, {
        status: "invalid",
        isArchived: true,
      });
      appliedCount += 1;
      continue;
    }
  }

  return {
    state: nextState,
    appliedCount,
    navigationTarget: needsPlanningReview ? "planning" : appliedCount > 0 ? "library" : null,
  };
}
