import {
  buildSystemAnalysisSnapshot,
} from "./systemAnalysisSnapshot";
import {
  normalizeLocalDateKey,
  toLocalDateKey,
} from "../../utils/datetime";

export const SYSTEM_ANALYSIS_ELIGIBILITY_REQUIREMENTS = Object.freeze({
  MIN_DAYS_SINCE_ACTIVATION: 7,
  MIN_PLANNED_BLOCKS: 10,
  MIN_EXECUTION_OUTCOMES: 5,
  MIN_ACTIVE_DAYS: 3,
  MIN_COMPLETION_OR_FRICTION_SIGNALS: 1,
});

export const SYSTEM_ANALYSIS_LOCKED_COPY =
  "Continue à exécuter tes blocs pendant quelques jours. L’analyse système devient utile quand elle peut lire ton vrai comportement.";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function resolveNowDateKey(now) {
  const safeNow = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return toLocalDateKey(safeNow);
}

function dayDiff(fromKey, toKey) {
  const from = normalizeDateKey(fromKey);
  const to = normalizeDateKey(toKey);
  if (!from || !to) return null;
  const fromTime = Date.parse(`${from}T00:00:00`);
  const toTime = Date.parse(`${to}T00:00:00`);
  if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) return null;
  return Math.max(0, Math.round((toTime - fromTime) / 86400000));
}

function getHistoryDateKey(history) {
  return (
    normalizeDateKey(history?.dateKey) ||
    normalizeDateKey(history?.date) ||
    normalizeDateKey(history?.endAt) ||
    normalizeDateKey(history?.startAt) ||
    ""
  );
}

function resolveActivationDateKey(state) {
  const safeState = isPlainObject(state) ? state : {};
  const committedAt = normalizeDateKey(safeState.ui?.firstRunV1?.commitV1?.appliedAt);
  if (committedAt) {
    return { dateKey: committedAt, source: "firstRunV1.commitV1.appliedAt" };
  }

  const candidateDates = [
    ...safeArray(safeState.occurrences).map((occurrence) => normalizeDateKey(occurrence?.date)),
    ...safeArray(safeState.sessionHistory).map(getHistoryDateKey),
  ].filter(Boolean).sort();
  if (candidateDates[0]) {
    return { dateKey: candidateDates[0], source: "earliest_execution_data" };
  }
  return { dateKey: "", source: "missing" };
}

function buildProgressRequirement(current, target) {
  const safeCurrent = Number.isFinite(Number(current)) ? Number(current) : 0;
  return {
    current: safeCurrent,
    target,
    remaining: Math.max(0, target - safeCurrent),
    complete: safeCurrent >= target,
  };
}

function addMissing(missingRequirements, code, label, progress) {
  missingRequirements.push({
    code,
    label,
    ...progress,
  });
}

export function buildSystemAnalysisEligibility({
  state,
  snapshot,
  now,
} = {}) {
  const safeState = isPlainObject(state) ? state : {};
  const safeSnapshot = isPlainObject(snapshot)
    ? snapshot
    : buildSystemAnalysisSnapshot({ state: safeState, now });
  const nowDateKey = normalizeDateKey(safeSnapshot.referenceDateKey) || resolveNowDateKey(now);
  const activation = resolveActivationDateKey(safeState);
  const daysSinceActivation = activation.dateKey ? dayDiff(activation.dateKey, nowDateKey) : 0;
  const requirements = SYSTEM_ANALYSIS_ELIGIBILITY_REQUIREMENTS;
  const completionOrFrictionSignals =
    Number(safeSnapshot.executionStats?.completedCount || 0) +
    Number(safeSnapshot.executionStats?.frictionCount || 0) +
    Number(safeSnapshot.sessionStats?.frictionCount || 0);

  const progressToUnlock = {
    daysSinceActivation: buildProgressRequirement(daysSinceActivation, requirements.MIN_DAYS_SINCE_ACTIVATION),
    plannedBlocks: buildProgressRequirement(safeSnapshot.executionStats?.expectedCount, requirements.MIN_PLANNED_BLOCKS),
    executionOutcomes: buildProgressRequirement(safeSnapshot.executionStats?.outcomeCount, requirements.MIN_EXECUTION_OUTCOMES),
    activeDays: buildProgressRequirement(safeSnapshot.executionStats?.activeDayCount, requirements.MIN_ACTIVE_DAYS),
    completionOrFrictionSignals: buildProgressRequirement(
      completionOrFrictionSignals,
      requirements.MIN_COMPLETION_OR_FRICTION_SIGNALS
    ),
  };

  const missingRequirements = [];
  if (!activation.dateKey) {
    addMissing(missingRequirements, "activation_date_missing", "Date d’activation manquante", {
      current: 0,
      target: 1,
      remaining: 1,
      complete: false,
    });
  }
  if (!progressToUnlock.daysSinceActivation.complete) {
    addMissing(missingRequirements, "activation_too_recent", "Activation trop récente", progressToUnlock.daysSinceActivation);
  }
  if (!progressToUnlock.plannedBlocks.complete) {
    addMissing(missingRequirements, "not_enough_planned_blocks", "Pas assez de blocs planifiés", progressToUnlock.plannedBlocks);
  }
  if (!progressToUnlock.executionOutcomes.complete) {
    addMissing(missingRequirements, "not_enough_execution_outcomes", "Pas assez de résultats d’exécution", progressToUnlock.executionOutcomes);
  }
  if (!progressToUnlock.activeDays.complete) {
    addMissing(missingRequirements, "not_enough_active_days", "Pas assez de jours actifs", progressToUnlock.activeDays);
  }
  if (!progressToUnlock.completionOrFrictionSignals.complete) {
    addMissing(
      missingRequirements,
      "not_enough_completion_or_friction",
      "Pas assez de signal de completion ou de friction",
      progressToUnlock.completionOrFrictionSignals
    );
  }

  const eligible = missingRequirements.length === 0;
  return {
    eligible,
    reasons: eligible
      ? ["enough_real_usage_data"]
      : missingRequirements.map((requirement) => requirement.code),
    missingRequirements,
    unlockCopy: eligible ? "" : SYSTEM_ANALYSIS_LOCKED_COPY,
    progressToUnlock,
    activation: {
      dateKey: activation.dateKey || null,
      source: activation.source,
      daysSinceActivation,
    },
  };
}
