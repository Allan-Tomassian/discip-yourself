import { ANALYSIS_COPY } from "../../ui/labels";

export function resolveManualAiDisplayState({
  loading = false,
  visibleAnalysis = null,
  wasRefreshed = false,
} = {}) {
  if (!visibleAnalysis && !loading) {
    return {
      kind: "local",
      label: ANALYSIS_COPY.localDiagnostic,
      isAi: false,
    };
  }

  if (visibleAnalysis && wasRefreshed) {
    return {
      kind: "ai_updated",
      label: ANALYSIS_COPY.coachAnalysisUpdated,
      isAi: true,
    };
  }

  return {
    kind: "ai",
    label: ANALYSIS_COPY.coachAnalysis,
    isAi: true,
  };
}
