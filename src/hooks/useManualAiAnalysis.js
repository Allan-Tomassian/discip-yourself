import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureManualAiAnalysisState,
  getManualAiAnalysisEntry,
  removeManualAiAnalysisEntry,
  upsertManualAiAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import { getManualAiLoadingStages } from "../features/manualAi/loadingStages";

function deriveDefaultErrorMessage(result) {
  const code = String(result?.errorCode || "").trim().toUpperCase();
  if (code === "DISABLED") return "Analyse indisponible sur cet appareil.";
  if (code === "UNAUTHORIZED") return "Connecte-toi pour lancer l’analyse.";
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") return "Analyse indisponible pour le moment.";
  if (code === "NETWORK_ERROR") return "Analyse indisponible hors ligne.";
  return "Analyse indisponible.";
}

export function useManualAiAnalysis({
  data,
  setData,
  contextKey,
  surface = "default",
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingStageIndex, setLoadingStageIndex] = useState(-1);
  const [requestDiagnostics, setRequestDiagnostics] = useState({
    deliverySource: null,
    hadVisibleLoading: false,
    savedAt: null,
    wasRefreshed: false,
  });
  const loadingStages = useMemo(() => getManualAiLoadingStages(surface), [surface]);

  const analysisState = useMemo(
    () => ensureManualAiAnalysisState(data?.ui?.manualAiAnalysisV1),
    [data?.ui?.manualAiAnalysisV1]
  );
  const visibleAnalysis = useMemo(
    () => getManualAiAnalysisEntry(analysisState, contextKey),
    [analysisState, contextKey]
  );

  useEffect(() => {
    setLoading(false);
    setError("");
    setRequestDiagnostics({
      deliverySource: visibleAnalysis ? "persisted" : null,
      hadVisibleLoading: false,
      savedAt: visibleAnalysis?.savedAt || null,
      wasRefreshed: false,
    });
  }, [contextKey]);

  useEffect(() => {
    if (!loading) {
      setLoadingStageIndex(-1);
      return undefined;
    }
    setLoadingStageIndex(0);
    if (loadingStages.length <= 1) return undefined;
    const intervalId = globalThis.setInterval(() => {
      setLoadingStageIndex((current) => {
        const safeCurrent = Number.isFinite(current) ? current : 0;
        if (safeCurrent >= loadingStages.length - 1) return safeCurrent;
        return safeCurrent + 1;
      });
    }, 1200);
    return () => globalThis.clearInterval(intervalId);
  }, [loading, loadingStages]);

  const dismissAnalysis = useCallback(() => {
    if (!contextKey || typeof setData !== "function") return;
    setData((previous) => {
      const safePrevious = previous && typeof previous === "object" ? previous : {};
      const safeUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
      const nextManualAiState = removeManualAiAnalysisEntry(safeUi.manualAiAnalysisV1, contextKey);
      return {
        ...safePrevious,
        ui: {
          ...safeUi,
          manualAiAnalysisV1: nextManualAiState,
        },
      };
    });
    setError("");
    setLoading(false);
    setRequestDiagnostics({
      deliverySource: null,
      hadVisibleLoading: false,
      savedAt: null,
      wasRefreshed: false,
    });
  }, [contextKey, setData]);

  const runAnalysis = useCallback(
    async ({
      execute,
      serializeSuccess,
      errorMessage = deriveDefaultErrorMessage,
    }) => {
      if (typeof execute !== "function" || typeof serializeSuccess !== "function" || !contextKey) {
        return { ok: false, errorCode: "INVALID_REQUEST" };
      }
      setLoading(true);
      setError("");
        setRequestDiagnostics((current) => ({
          deliverySource: current.deliverySource,
          hadVisibleLoading: !visibleAnalysis,
          savedAt: current.savedAt,
          wasRefreshed: false,
        }));
      try {
        const result = await execute();
        if (!result?.ok) {
          const nextMessage = typeof errorMessage === "function" ? errorMessage(result) : deriveDefaultErrorMessage(result);
          setError(nextMessage);
          setLoading(false);
          return result;
        }
        const nextEntry = serializeSuccess(result);
        if (!nextEntry) {
          setError("Analyse indisponible.");
          setLoading(false);
          return { ok: false, errorCode: "INVALID_RESPONSE" };
        }
        if (typeof setData === "function") {
          setData((previous) => {
            const safePrevious = previous && typeof previous === "object" ? previous : {};
            const safeUi = safePrevious.ui && typeof safePrevious.ui === "object" ? safePrevious.ui : {};
            const nextManualAiState = upsertManualAiAnalysisEntry(safeUi.manualAiAnalysisV1, nextEntry);
            return {
              ...safePrevious,
              ui: {
                ...safeUi,
                manualAiAnalysisV1: nextManualAiState,
              },
            };
          });
        }
        setRequestDiagnostics({
          deliverySource: "network",
          hadVisibleLoading: !visibleAnalysis,
          savedAt: nextEntry.savedAt || Date.now(),
          wasRefreshed: Boolean(visibleAnalysis),
        });
        setLoading(false);
        setError("");
        return {
          ...result,
          entry: nextEntry,
        };
      } catch (runtimeError) {
        setError("Analyse indisponible.");
        setLoading(false);
        return { ok: false, errorCode: "NETWORK_ERROR", error: runtimeError };
      }
    },
    [contextKey, setData, visibleAnalysis]
  );

  return {
    visibleAnalysis,
    loading,
    error,
    runAnalysis,
    dismissAnalysis,
    isPersistedForContext: Boolean(visibleAnalysis),
    loadingStageIndex,
    loadingStageLabel:
      loading && loadingStages.length
        ? loadingStages[Math.max(0, Math.min(loadingStageIndex, loadingStages.length - 1))]
        : "",
    wasRefreshed: Boolean(requestDiagnostics.wasRefreshed),
    requestDiagnostics,
  };
}
