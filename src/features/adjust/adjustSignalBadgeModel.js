import {
  SYSTEM_SIGNAL_SEVERITY,
  getPrimarySystemSignal,
} from "../../logic/systemSignals";
import { normalizeLocalDateKey, todayLocalKey } from "../../utils/dateKey";
import { buildAdjustDiagnostic } from "./adjustDiagnostic";

function isBadgeSeverity(severity) {
  return severity === SYSTEM_SIGNAL_SEVERITY.ATTENTION || severity === SYSTEM_SIGNAL_SEVERITY.CRITICAL;
}

function resolveActiveDateKey(data) {
  return (
    normalizeLocalDateKey(data?.ui?.selectedDateKey) ||
    normalizeLocalDateKey(data?.ui?.selectedDate) ||
    todayLocalKey()
  );
}

export function buildSignalBadgeModelFromSignals(signals) {
  const primarySignal = getPrimarySystemSignal(Array.isArray(signals) ? signals : []);
  if (!primarySignal || !isBadgeSeverity(primarySignal.severity)) return null;
  const critical = primarySignal.severity === SYSTEM_SIGNAL_SEVERITY.CRITICAL;
  return {
    severity: primarySignal.severity,
    tone: critical ? SYSTEM_SIGNAL_SEVERITY.CRITICAL : SYSTEM_SIGNAL_SEVERITY.ATTENTION,
    label: critical ? "Signal critique à ajuster" : "Signal d’ajustement disponible",
    signalId: primarySignal.id || "",
    signalType: primarySignal.type,
  };
}

// App-level bridge for the bottom nav. BottomNavigation stays presentation-only.
export function buildAdjustSignalBadgeModel(data) {
  const safeData = data && typeof data === "object" ? data : {};
  const activeDateKey = resolveActiveDateKey(safeData);
  const diagnostic = buildAdjustDiagnostic(safeData, activeDateKey);
  return buildSignalBadgeModelFromSignals(diagnostic.systemSignals);
}
