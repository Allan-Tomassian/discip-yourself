export function resolveManualAiDisplayState({
  loading = false,
  visibleAnalysis = null,
  wasRefreshed = false,
} = {}) {
  if (!visibleAnalysis && !loading) {
    return {
      kind: "local",
      label: "Diagnostic local",
      isAi: false,
    };
  }

  if (visibleAnalysis && wasRefreshed) {
    return {
      kind: "ai_updated",
      label: "Analyse IA mise à jour",
      isAi: true,
    };
  }

  return {
    kind: "ai",
    label: "Analyse IA",
    isAi: true,
  };
}
