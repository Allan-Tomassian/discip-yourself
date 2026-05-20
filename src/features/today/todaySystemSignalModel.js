import {
  SYSTEM_SIGNAL_ACTION_TYPE,
  SYSTEM_SIGNAL_SEVERITY,
  SYSTEM_SIGNAL_TYPE,
} from "../../logic/systemSignals";
import { normalizeLocalDateKey } from "../../utils/dateKey";

const COPY_BY_TYPE = Object.freeze({
  [SYSTEM_SIGNAL_TYPE.OVERLOAD]: {
    title: "Surcharge détectée",
    message: "Allège avant de forcer l’exécution.",
  },
  [SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK]: {
    title: "Un bloc bloque ton exécution",
    message: "Tu peux récupérer avec une version simple.",
  },
  [SYSTEM_SIGNAL_TYPE.REPORTED_BLOCK]: {
    title: "Bloc à replacer",
    message: "Une version plus claire évite l’improvisation.",
  },
  [SYSTEM_SIGNAL_TYPE.REPEATED_POSTPONE]: {
    title: "Bloc à replacer",
    message: "Une version plus claire évite l’improvisation.",
  },
  [SYSTEM_SIGNAL_TYPE.MISSED_BLOCK]: {
    title: "Friction détectée",
    message: "Reprends sans dette avec un ajustement simple.",
  },
  [SYSTEM_SIGNAL_TYPE.NO_NEXT_BLOCK]: {
    title: "Prochain bloc flou",
    message: "Clarifie le prochain créneau avant d’avancer.",
  },
  [SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK]: {
    title: "Bloc critique en retard",
    message: "Récupère avec une version courte.",
  },
});

function normalizeStatus(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function isVisibleSeverity(severity) {
  return severity === SYSTEM_SIGNAL_SEVERITY.ATTENTION || severity === SYSTEM_SIGNAL_SEVERITY.CRITICAL;
}

function shouldSuppressDuplicate(signalType, primaryAction) {
  const primaryStatus = normalizeStatus(primaryAction?.status);
  if (
    (signalType === SYSTEM_SIGNAL_TYPE.BLOCKED_BLOCK || signalType === SYSTEM_SIGNAL_TYPE.REPORTED_BLOCK) &&
    (primaryStatus === "blocked" || primaryStatus === "reported")
  ) {
    return true;
  }
  return signalType === SYSTEM_SIGNAL_TYPE.LATE_CRITICAL_BLOCK && primaryStatus === "late";
}

// Derived Today presentation model only. It does not mutate signals, Today data, or persisted occurrence state.
export function buildTodaySystemSignalSurface({
  primarySystemSignal = null,
  primaryAction = null,
  dateKey = "",
  todayKey = "",
} = {}) {
  if (!primarySystemSignal || typeof primarySystemSignal !== "object") return null;
  const activeDateKey = normalizeLocalDateKey(dateKey);
  const normalizedTodayKey = normalizeLocalDateKey(todayKey);
  if (!activeDateKey || !normalizedTodayKey || activeDateKey !== normalizedTodayKey) return null;
  if (!isVisibleSeverity(primarySystemSignal.severity)) return null;
  if (shouldSuppressDuplicate(primarySystemSignal.type, primaryAction)) return null;

  const copy = COPY_BY_TYPE[primarySystemSignal.type] || null;
  if (!copy) return null;

  return {
    severity: primarySystemSignal.severity,
    tone:
      primarySystemSignal.severity === SYSTEM_SIGNAL_SEVERITY.CRITICAL
        ? SYSTEM_SIGNAL_SEVERITY.CRITICAL
        : SYSTEM_SIGNAL_SEVERITY.ATTENTION,
    title: copy.title,
    message: copy.message,
    ctaLabel: "Ajuster",
    actionType: SYSTEM_SIGNAL_ACTION_TYPE.OPEN_ADJUST,
    signalId: primarySystemSignal.id || "",
    signalType: primarySystemSignal.type,
  };
}
