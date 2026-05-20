import { normalizeLocalDateKey } from "../utils/dateKey";
import {
  EXECUTION_SURFACE_STATUS,
  getSessionFrictionSignalsForDate,
} from "./executionStatus";
import { OCCURRENCE_STATUS, normalizeOccurrenceStatus } from "./occurrenceStatus";

export const SYSTEM_SIGNAL_TYPE = Object.freeze({
  OVERLOAD: "overload",
  MISSED_BLOCK: "missed_block",
  NO_NEXT_BLOCK: "no_next_block",
  REPEATED_POSTPONE: "repeated_postpone",
  BLOCKED_BLOCK: "blocked_block",
  REPORTED_BLOCK: "reported_block",
  NEGLECTED_CATEGORY: "neglected_category",
  LATE_CRITICAL_BLOCK: "late_critical_block",
});

export const SYSTEM_SIGNAL_SEVERITY = Object.freeze({
  INFO: "info",
  ATTENTION: "attention",
  CRITICAL: "critical",
});

export const SYSTEM_SIGNAL_ACTION_TYPE = Object.freeze({
  OPEN_ADJUST: "open_adjust",
  OPEN_COACH: "open_coach",
  OPEN_PLANNING: "open_planning",
});

const SEVERITY_RANK = Object.freeze({
  [SYSTEM_SIGNAL_SEVERITY.CRITICAL]: 3,
  [SYSTEM_SIGNAL_SEVERITY.ATTENTION]: 2,
  [SYSTEM_SIGNAL_SEVERITY.INFO]: 1,
});

const TYPE_PRIORITY = Object.freeze({
  [SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK]: 90,
  [SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK]: 80,
  [SYSTEM_SIGNAL_TYPE.MISSED_BLOCK]: 70,
  [SYSTEM_SIGNAL_TYPE.REPORTED_BLOCK]: 60,
  [SYSTEM_SIGNAL_TYPE.REPEATED_POSTPONE]: 55,
  [SYSTEM_SIGNAL_TYPE.OVERLOAD]: 50,
  [SYSTEM_SIGNAL_TYPE.NO_NEXT_BLOCK]: 40,
  [SYSTEM_SIGNAL_TYPE.NEGLECTED_CATEGORY]: 30,
});

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeDateKey(value) {
  return normalizeLocalDateKey(value) || "";
}

function buildSignalId({ type, occurrenceId = "", historyId = "", dateKey = "" }) {
  return [type, occurrenceId, historyId, dateKey].map((part) => safeString(part) || "all").join(":");
}

function buildEvidence(base = {}) {
  return Object.fromEntries(
    Object.entries(base).filter(([, value]) => {
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== "";
    })
  );
}

function createSignal({ type, severity, title, message, evidence, action }) {
  const safeEvidence = buildEvidence(evidence);
  return {
    id: buildSignalId({
      type,
      occurrenceId: safeEvidence.occurrenceId,
      historyId: safeEvidence.historyId,
      dateKey: safeEvidence.dateKey,
    }),
    type,
    severity,
    title,
    message,
    evidence: safeEvidence,
    action,
  };
}

function normalizeSignal(signal) {
  if (!signal || typeof signal !== "object") return null;
  const type = safeString(signal.type);
  const severity = safeString(signal.severity);
  if (!Object.values(SYSTEM_SIGNAL_TYPE).includes(type)) return null;
  if (!Object.values(SYSTEM_SIGNAL_SEVERITY).includes(severity)) return null;
  return {
    id: safeString(signal.id) || buildSignalId({ type, ...(signal.evidence || {}) }),
    type,
    severity,
    title: safeString(signal.title),
    message: safeString(signal.message),
    evidence: signal.evidence && typeof signal.evidence === "object" ? signal.evidence : {},
    action: signal.action && typeof signal.action === "object" ? signal.action : null,
  };
}

function dedupeSignals(signals) {
  const seen = new Set();
  const deduped = [];
  for (const rawSignal of signals) {
    const signal = normalizeSignal(rawSignal);
    if (!signal) continue;
    const key = [
      signal.type,
      safeString(signal.evidence?.occurrenceId),
      safeString(signal.evidence?.historyId),
      safeString(signal.evidence?.dateKey),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(signal);
  }
  return deduped;
}

function sortSignals(signals) {
  return [...signals].sort((left, right) => {
    const severityDelta = (SEVERITY_RANK[right.severity] || 0) - (SEVERITY_RANK[left.severity] || 0);
    if (severityDelta) return severityDelta;
    const typeDelta = (TYPE_PRIORITY[right.type] || 0) - (TYPE_PRIORITY[left.type] || 0);
    if (typeDelta) return typeDelta;
    return left.id.localeCompare(right.id);
  });
}

function getOccurrenceDateKey(occurrence) {
  return normalizeDateKey(occurrence?.date || occurrence?.dateKey);
}

function getOccurrenceId(occurrence) {
  return safeString(occurrence?.id);
}

function buildSessionFrictionSignals({ sessionHistory, dateKey }) {
  return getSessionFrictionSignalsForDate({ sessionHistory, dateKey }).map((signal) => {
    const blocked = signal.status === EXECUTION_SURFACE_STATUS.BLOCKED;
    return createSignal({
      type: blocked ? SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK : SYSTEM_SIGNAL_TYPE.REPORTED_BLOCK,
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      title: blocked ? "Bloc bloqué" : "Bloc signalé",
      message: blocked
        ? "Un bloc a rencontré une friction d’exécution."
        : "Un bloc a été signalé comme à réorganiser.",
      evidence: {
        source: "sessionHistory",
        occurrenceId: signal.occurrenceId,
        historyId: signal.historyId,
        dateKey: signal.dateKey,
      },
      action: {
        label: blocked ? "Ajuster" : "Réorganiser",
        type: blocked ? SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST : SYSTEM_SIGNAL_ACTION_TYPE.OPEN_PLANNING,
      },
    });
  });
}

function buildOccurrenceSignals({ occurrences, dateKey }) {
  const signals = [];
  const occurrencesForDate = safeArray(occurrences).filter((occurrence) => getOccurrenceDateKey(occurrence) === dateKey);
  const missed = occurrencesForDate.filter(
    (occurrence) => normalizeOccurrenceStatus(occurrence?.status) === OCCURRENCE_STATUS.MISSED
  );
  if (missed.length) {
    signals.push(createSignal({
      type: SYSTEM_SIGNAL_TYPE.MISSED_BLOCK,
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      title: `${missed.length} bloc${missed.length > 1 ? "s" : ""} manqué${missed.length > 1 ? "s" : ""}`,
      message: "La journée contient une friction réelle à corriger sans dette.",
      evidence: {
        source: "occurrences",
        dateKey,
        count: missed.length,
        occurrenceIds: missed.map(getOccurrenceId).filter(Boolean),
      },
      action: { label: "Ajuster", type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST },
    }));
  }

  const postponedCount = occurrencesForDate.filter(
    (occurrence) => normalizeOccurrenceStatus(occurrence?.status) === OCCURRENCE_STATUS.RESCHEDULED
  ).length;
  if (postponedCount >= 2) {
    signals.push(createSignal({
      type: SYSTEM_SIGNAL_TYPE.REPEATED_POSTPONE,
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      title: "Reports répétés",
      message: "Plusieurs blocs ont été déplacés. Le planning mérite une version plus simple.",
      evidence: { source: "occurrences", dateKey, count: postponedCount },
      action: { label: "Réorganiser", type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_PLANNING },
    }));
  }
  return signals;
}

function buildTodaySignals(todayData, dateKey) {
  if (!todayData || typeof todayData !== "object") return [];
  const signals = [];
  const primaryAction = todayData.primaryAction || {};
  if (primaryAction.status === "late") {
    signals.push(createSignal({
      type: SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK,
      severity: SYSTEM_SIGNAL_SEVERITY.CRITICAL,
      title: "Bloc critique en retard",
      message: "Le prochain bloc utile demande une reprise courte.",
      evidence: {
        source: "todayData",
        dateKey,
        occurrenceId: primaryAction.occurrenceId,
        actionId: primaryAction.actionId,
      },
      action: { label: "Ajuster", type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST },
    }));
  }
  return signals;
}

function buildAdjustSignals(adjustDiagnostic, dateKey) {
  if (!adjustDiagnostic || typeof adjustDiagnostic !== "object") return [];
  const summary = adjustDiagnostic.summary || {};
  const signals = [];
  const remainingMinutes = Number(summary.remainingMinutes);
  const remainingCount = Number(summary.remainingCount);
  if ((Number.isFinite(remainingMinutes) && remainingMinutes >= 120) || (Number.isFinite(remainingCount) && remainingCount >= 4)) {
    signals.push(createSignal({
      type: SYSTEM_SIGNAL_TYPE.OVERLOAD,
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      title: "Charge élevée",
      message: "La charge restante dépasse ce qui reste facile à protéger.",
      evidence: {
        source: "adjustDiagnostic",
        dateKey,
        remainingMinutes: Number.isFinite(remainingMinutes) ? remainingMinutes : null,
        remainingCount: Number.isFinite(remainingCount) ? remainingCount : null,
      },
      action: { label: "Ajuster", type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST },
    }));
  }

  if (!adjustDiagnostic.nextBlock && Number(summary.plannedCount) > Number(summary.doneCount)) {
    signals.push(createSignal({
      type: SYSTEM_SIGNAL_TYPE.NO_NEXT_BLOCK,
      severity: SYSTEM_SIGNAL_SEVERITY.ATTENTION,
      title: "Prochain bloc flou",
      message: "Il reste de l’exécution, mais aucun prochain bloc net ne ressort.",
      evidence: {
        source: "adjustDiagnostic",
        dateKey,
        plannedCount: summary.plannedCount,
        doneCount: summary.doneCount,
      },
      action: { label: "Réorganiser", type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_PLANNING },
    }));
  }

  const neglected = safeArray(adjustDiagnostic.categorySignals).find(
    (signal) => Number(signal?.expected) >= 2 && Number(signal?.done) === 0
  );
  if (neglected) {
    signals.push(createSignal({
      type: SYSTEM_SIGNAL_TYPE.NEGLECTED_CATEGORY,
      severity: SYSTEM_SIGNAL_SEVERITY.INFO,
      title: `${safeString(neglected.label) || "Catégorie"} en retrait`,
      message: "Une direction structurée existe, mais elle n’a pas encore produit d’exécution récente.",
      evidence: {
        source: "adjustDiagnostic",
        dateKey,
        categoryId: neglected.id,
        expected: neglected.expected,
        done: neglected.done,
      },
      action: { label: "Ajuster", type: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST },
    }));
  }
  return signals;
}

export function buildSystemSignals({
  occurrences = [],
  sessionHistory = [],
  activeSession = null,
  todayData = null,
  adjustDiagnostic = null,
  dateKey = "",
} = {}) {
  void activeSession;
  const normalizedDateKey =
    normalizeDateKey(dateKey) ||
    normalizeDateKey(todayData?.date?.key) ||
    normalizeDateKey(adjustDiagnostic?.summary?.activeDateKey);
  if (!normalizedDateKey) return [];

  const sessionSignals = buildSessionFrictionSignals({ sessionHistory, dateKey: normalizedDateKey });
  const occurrenceSignals = buildOccurrenceSignals({ occurrences, dateKey: normalizedDateKey });
  const todaySignals = buildTodaySignals(todayData, normalizedDateKey);
  const adjustSignals = buildAdjustSignals(adjustDiagnostic, normalizedDateKey);

  return sortSignals(dedupeSignals([...todaySignals, ...sessionSignals, ...occurrenceSignals, ...adjustSignals]));
}

export function getPrimarySystemSignal(signals) {
  return sortSignals(dedupeSignals(signals))[0] || null;
}
