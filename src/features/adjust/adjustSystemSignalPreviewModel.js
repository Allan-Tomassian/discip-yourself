import { SYSTEM_SIGNAL_SEVERITY } from "../../logic/systemSignals";

export function buildAdjustSystemSignalPreview(signal) {
  if (!signal || typeof signal !== "object") return null;
  if (
    signal.severity !== SYSTEM_SIGNAL_SEVERITY.ATTENTION &&
    signal.severity !== SYSTEM_SIGNAL_SEVERITY.CRITICAL
  ) {
    return null;
  }
  return {
    severity: signal.severity,
    tone:
      signal.severity === SYSTEM_SIGNAL_SEVERITY.CRITICAL
        ? SYSTEM_SIGNAL_SEVERITY.CRITICAL
        : SYSTEM_SIGNAL_SEVERITY.ATTENTION,
    title: signal.title || "Signal système",
    message: signal.message || "Un ajustement peut rendre le prochain bloc plus lisible.",
    signalId: signal.id || "",
    signalType: signal.type || "",
  };
}
