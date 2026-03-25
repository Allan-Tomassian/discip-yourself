import { startOfWeekKey } from "../../utils/dates";

export const MANUAL_AI_ANALYSIS_VERSION = 1;
export const MANUAL_AI_ANALYSIS_MAX_ENTRIES = 40;
export const MANUAL_AI_STORAGE_SCOPE = Object.freeze({
  CLOUD: "cloud",
  LOCAL_FALLBACK: "local_fallback",
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeString(value) {
  return typeof value === "string" ? value : "";
}

function safeNullableString(value) {
  return value == null ? null : safeString(value);
}

function safeInteger(value) {
  return Number.isInteger(value) ? value : null;
}

function normalizeStorageScope(value) {
  return value === MANUAL_AI_STORAGE_SCOPE.CLOUD
    ? MANUAL_AI_STORAGE_SCOPE.CLOUD
    : MANUAL_AI_STORAGE_SCOPE.LOCAL_FALLBACK;
}

function normalizeAction(value) {
  if (!isPlainObject(value)) return null;
  const label = safeString(value.label).trim();
  const intent = safeString(value.intent).trim();
  if (!label || !intent) return null;
  return {
    label,
    intent,
    categoryId: safeNullableString(value.categoryId),
    actionId: safeNullableString(value.actionId),
    occurrenceId: safeNullableString(value.occurrenceId),
    dateKey: safeNullableString(value.dateKey),
  };
}

function normalizeEntry(entry) {
  if (!isPlainObject(entry)) return null;
  const contextKey = safeString(entry.contextKey).trim();
  const surface = safeString(entry.surface).trim();
  const kind = safeString(entry.kind).trim();
  const headline = safeString(entry.headline).trim();
  const reason = safeString(entry.reason).trim();
  const primaryAction = normalizeAction(entry.primaryAction);
  if (!contextKey || !surface || !kind || !headline || !reason || !primaryAction) return null;
  return {
    version: MANUAL_AI_ANALYSIS_VERSION,
    contextKey,
    surface,
    kind,
    savedAt: Number.isFinite(entry.savedAt) ? entry.savedAt : Date.now(),
    storageScope: normalizeStorageScope(entry.storageScope),
    decisionSource: safeNullableString(entry.decisionSource),
    interventionType: safeNullableString(entry.interventionType),
    headline,
    reason,
    primaryAction,
    secondaryAction: normalizeAction(entry.secondaryAction),
    suggestedDurationMin: safeInteger(entry.suggestedDurationMin),
    requestId: safeNullableString(entry.requestId),
    selectedDateKey: safeNullableString(entry.selectedDateKey),
    activeCategoryId: safeNullableString(entry.activeCategoryId),
    fallbackReason: safeNullableString(entry.fallbackReason),
  };
}

function sortEntriesBySavedAt(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTs = Number.isFinite(left?.savedAt) ? left.savedAt : 0;
    const rightTs = Number.isFinite(right?.savedAt) ? right.savedAt : 0;
    if (leftTs !== rightTs) return rightTs - leftTs;
    return safeString(left?.contextKey).localeCompare(safeString(right?.contextKey));
  });
}

export function ensureManualAiAnalysisState(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const entriesSource = isPlainObject(source.entriesByContextKey) ? source.entriesByContextKey : {};
  const normalizedEntries = {};
  for (const [contextKey, rawEntry] of Object.entries(entriesSource)) {
    const entry = normalizeEntry(rawEntry);
    if (!entry) continue;
    normalizedEntries[contextKey] = entry;
  }
  const prunedEntries = {};
  for (const entry of sortEntriesBySavedAt(Object.values(normalizedEntries)).slice(0, MANUAL_AI_ANALYSIS_MAX_ENTRIES)) {
    prunedEntries[entry.contextKey] = entry;
  }
  return {
    version: MANUAL_AI_ANALYSIS_VERSION,
    entriesByContextKey: prunedEntries,
  };
}

export function getManualAiAnalysisEntry(rawValue, contextKey) {
  const safeContextKey = safeString(contextKey).trim();
  if (!safeContextKey) return null;
  const state = ensureManualAiAnalysisState(rawValue);
  return state.entriesByContextKey[safeContextKey] || null;
}

export function upsertManualAiAnalysisEntry(rawValue, entry) {
  const safeEntry = normalizeEntry(entry);
  const state = ensureManualAiAnalysisState(rawValue);
  if (!safeEntry) return state;
  const nextEntries = {
    ...state.entriesByContextKey,
    [safeEntry.contextKey]: safeEntry,
  };
  return ensureManualAiAnalysisState({
    version: MANUAL_AI_ANALYSIS_VERSION,
    entriesByContextKey: nextEntries,
  });
}

export function removeManualAiAnalysisEntry(rawValue, contextKey) {
  const safeContextKey = safeString(contextKey).trim();
  const state = ensureManualAiAnalysisState(rawValue);
  if (!safeContextKey || !state.entriesByContextKey[safeContextKey]) return state;
  const nextEntries = { ...state.entriesByContextKey };
  delete nextEntries[safeContextKey];
  return {
    version: MANUAL_AI_ANALYSIS_VERSION,
    entriesByContextKey: nextEntries,
  };
}

export function buildTodayManualAiContextKey({ userId, dateKey, activeCategoryId = null }) {
  return `today:${safeString(userId).trim()}:${safeString(dateKey).trim()}:${safeString(activeCategoryId).trim() || "all"}`;
}

export function buildPlanningManualAiContextKey({
  userId,
  planningView = "day",
  selectedDateKey,
  activeCategoryId = null,
}) {
  const safeView = planningView === "week" ? "week" : "day";
  const safeDateKey = safeString(selectedDateKey).trim();
  const scopeKey = safeView === "week" && safeDateKey ? startOfWeekKey(new Date(`${safeDateKey}T12:00:00`)) : safeDateKey;
  return `planning:${safeView}:${safeString(userId).trim()}:${scopeKey}:${safeString(activeCategoryId).trim() || "all"}`;
}

export function buildPilotageManualAiContextKey({
  userId,
  fromKey,
  toKey,
  activeCategoryId = null,
  windowId = "7d",
}) {
  return `pilotage:${safeString(userId).trim()}:${safeString(windowId).trim() || "7d"}:${safeString(fromKey).trim()}:${safeString(toKey).trim()}:${safeString(activeCategoryId).trim() || "all"}`;
}

export function createPersistedNowAnalysisEntry({
  contextKey,
  storageScope,
  coach,
}) {
  if (!isPlainObject(coach)) return null;
  const primaryAction = normalizeAction(coach.primaryAction);
  if (!primaryAction) return null;
  const headline = safeString(coach.headline).trim();
  const reason = safeString(coach.reason).trim();
  if (!headline || !reason) return null;
  return normalizeEntry({
    version: MANUAL_AI_ANALYSIS_VERSION,
    contextKey,
    surface: "today",
    kind: safeString(coach.kind).trim() || "now",
    savedAt: Date.now(),
    storageScope,
    decisionSource: safeNullableString(coach.decisionSource),
    interventionType: safeNullableString(coach.interventionType),
    headline,
    reason,
    primaryAction,
    secondaryAction: normalizeAction(coach.secondaryAction),
    suggestedDurationMin: safeInteger(coach.suggestedDurationMin),
    requestId: safeNullableString(coach?.meta?.requestId),
    selectedDateKey: safeNullableString(coach?.meta?.selectedDateKey),
    activeCategoryId: safeNullableString(coach?.meta?.activeCategoryId),
    fallbackReason: safeNullableString(coach?.meta?.fallbackReason),
  });
}

export function createPersistedChatAnalysisEntry({
  contextKey,
  surface,
  storageScope,
  reply,
}) {
  if (!isPlainObject(reply)) return null;
  const primaryAction = normalizeAction(reply.primaryAction);
  if (!primaryAction) return null;
  const headline = safeString(reply.headline).trim();
  const reason = safeString(reply.reason).trim();
  if (!headline || !reason) return null;
  return normalizeEntry({
    version: MANUAL_AI_ANALYSIS_VERSION,
    contextKey,
    surface,
    kind: safeString(reply.kind).trim() || "chat",
    savedAt: Date.now(),
    storageScope,
    decisionSource: safeNullableString(reply.decisionSource),
    interventionType: null,
    headline,
    reason,
    primaryAction,
    secondaryAction: normalizeAction(reply.secondaryAction),
    suggestedDurationMin: safeInteger(reply.suggestedDurationMin),
    requestId: safeNullableString(reply?.meta?.requestId),
    selectedDateKey: safeNullableString(reply?.meta?.selectedDateKey),
    activeCategoryId: safeNullableString(reply?.meta?.activeCategoryId),
    fallbackReason: safeNullableString(reply?.meta?.fallbackReason),
  });
}
