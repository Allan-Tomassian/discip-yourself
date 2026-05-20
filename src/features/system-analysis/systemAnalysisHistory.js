import { validateSystemAnalysisResult } from "./systemAnalysisContract";
import { normalizeLocalDateKey } from "../../utils/datetime";

export const SYSTEM_ANALYSIS_HISTORY_VERSION = 1;
export const SYSTEM_ANALYSIS_HISTORY_MAX_RECORDS = 6;

export const SYSTEM_ANALYSIS_RECORD_STATUS = Object.freeze({
  COMPLETED: "completed",
  PARTIALLY_APPLIED: "partially_applied",
  APPLIED: "applied",
  FAILED_APPLY: "failed_apply",
});

const RECORD_STATUSES = new Set(Object.values(SYSTEM_ANALYSIS_RECORD_STATUS));
const SOURCE = "premium_system_analysis";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value, maxLength = null) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!Number.isFinite(maxLength)) return trimmed;
  return trimmed.slice(0, Math.max(0, maxLength));
}

function uniqueStrings(values) {
  return Array.from(new Set(safeArray(values).map((value) => safeString(value)).filter(Boolean)));
}

function normalizeIso(value, fallback = "") {
  const raw = safeString(value, 80);
  if (!raw) return fallback;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function resolveNowIso(now) {
  if (now instanceof Date && !Number.isNaN(now.getTime())) return now.toISOString();
  return new Date().toISOString();
}

function normalizePeriod(period) {
  const source = isPlainObject(period) ? period : {};
  const startDateKey = normalizeLocalDateKey(source.startDateKey);
  const endDateKey = normalizeLocalDateKey(source.endDateKey);
  if (!startDateKey || !endDateKey) return null;
  const days = Number(source.days);
  return {
    startDateKey,
    endDateKey,
    days: Number.isFinite(days) && days > 0 ? Math.round(days) : null,
  };
}

function periodsEqual(left, right) {
  const a = normalizePeriod(left);
  const b = normalizePeriod(right);
  return Boolean(
    a &&
      b &&
      a.startDateKey === b.startDateKey &&
      a.endDateKey === b.endDateKey &&
      (a.days || null) === (b.days || null)
  );
}

function safeIdPart(value) {
  return safeString(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function buildRecordId({ snapshotHash, generatedAt, requestId }) {
  const hash = safeIdPart(snapshotHash) || "snapshot";
  const request = safeIdPart(requestId);
  const time = safeIdPart(generatedAt) || "generated";
  return `system_analysis_${hash}_${request || time}`;
}

function firstText(value) {
  if (typeof value === "string") return safeString(value, 240);
  if (isPlainObject(value)) {
    return safeString(value.title, 160) || safeString(value.message, 240) || safeString(value.reason, 240);
  }
  return "";
}

function summarizeResult(result) {
  const source = isPlainObject(result) ? result : {};
  return {
    executiveSummary: safeString(source.executiveSummary, 600),
    invisibleFriction: safeArray(source.invisibleFriction).map(firstText).filter(Boolean).slice(0, 3),
    recommendedCorrections: safeArray(source.recommendedCorrections).map(firstText).filter(Boolean).slice(0, 3),
    next7DaysFocus: safeArray(source.next7DaysFocus).map(firstText).filter(Boolean).slice(0, 2),
    dataLimitations: safeArray(source.dataLimitations).map(firstText).filter(Boolean).slice(0, 3),
  };
}

function normalizeEligibilityAtRun(eligibility) {
  const source = isPlainObject(eligibility) ? eligibility : {};
  return {
    eligible: source.eligible === true,
    reasons: uniqueStrings(source.reasons),
    missingRequirementCodes: safeArray(source.missingRequirements)
      .map((requirement) => safeString(requirement?.code))
      .filter(Boolean),
    progressToUnlock: isPlainObject(source.progressToUnlock) ? source.progressToUnlock : null,
  };
}

function normalizeRecord(rawRecord) {
  const source = isPlainObject(rawRecord) ? rawRecord : null;
  if (!source) return null;
  const id = safeString(source.id, 160);
  const snapshotHash = safeString(source.snapshotHash, 160);
  const period = normalizePeriod(source.period || source.result?.period);
  const result = isPlainObject(source.result) ? source.result : null;
  if (!id || !snapshotHash || !period || !result) return null;

  const generatedAt = normalizeIso(source.generatedAt || result.generatedAt, "");
  const savedAt = normalizeIso(source.savedAt, generatedAt || "");
  const status = RECORD_STATUSES.has(source.status) ? source.status : SYSTEM_ANALYSIS_RECORD_STATUS.COMPLETED;
  return {
    id,
    version: SYSTEM_ANALYSIS_HISTORY_VERSION,
    source: SOURCE,
    status,
    snapshotHash,
    period,
    referenceDateKey: normalizeLocalDateKey(source.referenceDateKey || source.result?.period?.endDateKey) || period.endDateKey,
    generatedAt: generatedAt || savedAt,
    savedAt: savedAt || generatedAt,
    result,
    summary: isPlainObject(source.summary) ? source.summary : summarizeResult(result),
    eligibilityAtRun: isPlainObject(source.eligibilityAtRun) ? source.eligibilityAtRun : normalizeEligibilityAtRun(null),
    appliedCorrectionIds: uniqueStrings(source.appliedCorrectionIds),
    changedOccurrenceIds: uniqueStrings(source.changedOccurrenceIds),
    appliedAt: normalizeIso(source.appliedAt, null),
    modelMeta: isPlainObject(source.modelMeta || result.modelMeta) ? { ...(source.modelMeta || result.modelMeta) } : {},
    snapshotMeta: {
      sourceCounts: isPlainObject(source.snapshotMeta?.sourceCounts) ? source.snapshotMeta.sourceCounts : {},
      dataLimitations: safeArray(source.snapshotMeta?.dataLimitations).map((entry) => (
        isPlainObject(entry) ? { ...entry } : safeString(entry, 240)
      )).filter(Boolean),
    },
  };
}

function sortRecords(records) {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left?.generatedAt || left?.savedAt || "") || 0;
    const rightTime = Date.parse(right?.generatedAt || right?.savedAt || "") || 0;
    if (leftTime !== rightTime) return rightTime - leftTime;
    return safeString(right?.id).localeCompare(safeString(left?.id));
  });
}

export function ensureSystemAnalysisHistoryState(raw) {
  const source = isPlainObject(raw) ? raw : {};
  const analyses = sortRecords(safeArray(source.analyses).map(normalizeRecord).filter(Boolean))
    .slice(0, SYSTEM_ANALYSIS_HISTORY_MAX_RECORDS);
  const requestedLatestId = safeString(source.latestAnalysisId);
  const latestAnalysisId = analyses.some((record) => record.id === requestedLatestId)
    ? requestedLatestId
    : analyses[0]?.id || null;

  return {
    version: SYSTEM_ANALYSIS_HISTORY_VERSION,
    latestAnalysisId,
    analyses,
  };
}

export function createSystemAnalysisRecord({
  result,
  snapshot,
  eligibility,
  state,
  now,
} = {}) {
  const validation = validateSystemAnalysisResult(result, { snapshot, state });
  if (!validation.ok) {
    return {
      ok: false,
      record: null,
      issues: validation.issues,
    };
  }

  const normalizedResult = validation.normalized;
  const savedAt = resolveNowIso(now);
  const generatedAt = normalizeIso(normalizedResult.generatedAt, savedAt);
  const snapshotHash = safeString(snapshot?.snapshotHash || normalizedResult.modelMeta?.snapshotHash, 160);
  const period = normalizePeriod(normalizedResult.period || snapshot?.period);
  if (!snapshotHash || !period) {
    return {
      ok: false,
      record: null,
      issues: [{
        code: "SYSTEM_ANALYSIS_RECORD_METADATA_MISSING",
        severity: "error",
        path: "snapshotHash",
        message: "System analysis record needs a snapshot hash and period.",
      }],
    };
  }

  const record = normalizeRecord({
    id: buildRecordId({
      snapshotHash,
      generatedAt,
      requestId: normalizedResult.modelMeta?.requestId,
    }),
    version: SYSTEM_ANALYSIS_HISTORY_VERSION,
    source: SOURCE,
    status: SYSTEM_ANALYSIS_RECORD_STATUS.COMPLETED,
    snapshotHash,
    period,
    referenceDateKey: normalizeLocalDateKey(snapshot?.referenceDateKey) || period.endDateKey,
    generatedAt,
    savedAt,
    result: normalizedResult,
    summary: summarizeResult(normalizedResult),
    eligibilityAtRun: normalizeEligibilityAtRun(eligibility),
    appliedCorrectionIds: [],
    changedOccurrenceIds: [],
    appliedAt: null,
    modelMeta: isPlainObject(normalizedResult.modelMeta) ? normalizedResult.modelMeta : {},
    snapshotMeta: {
      sourceCounts: isPlainObject(snapshot?.sourceCounts) ? snapshot.sourceCounts : {},
      dataLimitations: safeArray(snapshot?.dataLimitations).map((entry) => (
        isPlainObject(entry) ? { ...entry } : safeString(entry, 240)
      )).filter(Boolean),
    },
  });

  return {
    ok: Boolean(record),
    record,
    issues: [],
  };
}

export function upsertSystemAnalysisRecord(history, record) {
  const normalizedRecord = normalizeRecord(record);
  const current = ensureSystemAnalysisHistoryState(history);
  if (!normalizedRecord) return current;
  const byId = new Map(current.analyses.map((entry) => [entry.id, entry]));
  byId.set(normalizedRecord.id, normalizedRecord);
  const analyses = sortRecords(Array.from(byId.values())).slice(0, SYSTEM_ANALYSIS_HISTORY_MAX_RECORDS);
  return {
    version: SYSTEM_ANALYSIS_HISTORY_VERSION,
    latestAnalysisId: normalizedRecord.id,
    analyses,
  };
}

export function getLatestSystemAnalysisRecord(history) {
  const state = ensureSystemAnalysisHistoryState(history);
  return state.analyses.find((record) => record.id === state.latestAnalysisId) || state.analyses[0] || null;
}

export function findReusableSystemAnalysisRecord(history, { snapshotHash, period } = {}) {
  const safeHash = safeString(snapshotHash, 160);
  if (!safeHash) return null;
  const state = ensureSystemAnalysisHistoryState(history);
  return state.analyses.find((record) => record.snapshotHash === safeHash && periodsEqual(record.period, period)) || null;
}

export function markSystemAnalysisRecordApplied(
  history,
  {
    analysisId,
    appliedItems,
    changedOccurrenceIds,
    appliedAt,
    totalApplicableIds,
  } = {}
) {
  const state = ensureSystemAnalysisHistoryState(history);
  const safeAnalysisId = safeString(analysisId);
  if (!safeAnalysisId) return state;
  const appliedIds = uniqueStrings(safeArray(appliedItems).map((item) => item?.id || item));
  const changedIds = uniqueStrings(changedOccurrenceIds);
  const safeAppliedAt = normalizeIso(appliedAt, resolveNowIso());
  const totalApplicable = Number(totalApplicableIds);

  const analyses = state.analyses.map((record) => {
    if (record.id !== safeAnalysisId) return record;
    const nextAppliedCorrectionIds = uniqueStrings([...record.appliedCorrectionIds, ...appliedIds]);
    const nextChangedOccurrenceIds = uniqueStrings([...record.changedOccurrenceIds, ...changedIds]);
    const status = Number.isFinite(totalApplicable) && totalApplicable > 0 && nextAppliedCorrectionIds.length >= totalApplicable
      ? SYSTEM_ANALYSIS_RECORD_STATUS.APPLIED
      : SYSTEM_ANALYSIS_RECORD_STATUS.PARTIALLY_APPLIED;
    return {
      ...record,
      status,
      appliedCorrectionIds: nextAppliedCorrectionIds,
      changedOccurrenceIds: nextChangedOccurrenceIds,
      appliedAt: safeAppliedAt,
    };
  });

  return ensureSystemAnalysisHistoryState({
    version: SYSTEM_ANALYSIS_HISTORY_VERSION,
    latestAnalysisId: state.latestAnalysisId,
    analyses,
  });
}

export function buildSystemAnalysisHistoryDisplayModel({
  history,
  currentSnapshot,
  activeDateKey,
} = {}) {
  const record = getLatestSystemAnalysisRecord(history);
  if (!record) {
    return {
      visible: false,
      record: null,
      result: null,
      isStale: false,
      exactCacheAvailable: false,
      title: "",
      staleNote: "",
    };
  }
  const exactCacheAvailable = Boolean(
    currentSnapshot?.snapshotHash &&
      record.snapshotHash === currentSnapshot.snapshotHash &&
      periodsEqual(record.period, currentSnapshot.period)
  );
  const activeKey = normalizeLocalDateKey(activeDateKey);
  const isFutureContext = Boolean(activeKey && record.period?.endDateKey && activeKey > record.period.endDateKey);
  const isStale = !exactCacheAvailable || isFutureContext;
  return {
    visible: true,
    record,
    result: record.result,
    isStale,
    exactCacheAvailable,
    title: "Dernière analyse",
    staleNote: isStale ? "Ton système a changé depuis cette analyse." : "",
  };
}
