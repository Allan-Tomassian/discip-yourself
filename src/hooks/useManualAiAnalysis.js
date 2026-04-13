import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureManualAiAnalysisState,
  getManualAiAnalysisEntry,
  removeManualAiAnalysisEntry,
  upsertManualAiAnalysisEntry,
} from "../features/manualAi/manualAiAnalysis";
import { getManualAiLoadingStages } from "../features/manualAi/loadingStages";
import { buildAiDebugDetails, deriveAiUnavailableMessage } from "../infra/aiTransportDiagnostics";

function deriveDefaultErrorMessage(result) {
  return deriveAiUnavailableMessage(result, {
    disabled: "Analyse indisponible sur cet appareil.",
    unauthorized: "Connecte-toi pour lancer l’analyse.",
    rateLimited: "Analyse indisponible pour le moment.",
    offline: "Analyse indisponible hors ligne.",
    corsPrivateOrigin: "Analyse indisponible sur cette origine de test.",
    networkUnknown: "Analyse indisponible pour le moment.",
    fallback: "Analyse indisponible.",
  });
}

export function useManualAiAnalysis({
  data,
  setData,
  contextKey,
  surface = "default",
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorDiagnostics, setErrorDiagnostics] = useState(null);
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
    setErrorDiagnostics(null);
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
    setErrorDiagnostics(null);
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
      setErrorDiagnostics(null);
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
          setErrorDiagnostics(buildAiDebugDetails(result, { surface: "analysis" }));
          setLoading(false);
          return result;
        }
        const nextEntry = serializeSuccess(result);
        if (!nextEntry) {
          setError("Analyse indisponible.");
          setErrorDiagnostics(
            buildAiDebugDetails(
              {
                errorCode: "INVALID_RESPONSE",
                backendErrorCode: null,
                status: Number.isInteger(result?.status) ? result.status : null,
                requestId: result?.requestId || null,
              },
              { surface: "analysis" }
            )
          );
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
        setErrorDiagnostics(null);
        return {
          ...result,
          entry: nextEntry,
        };
      } catch (runtimeError) {
        setError("Analyse indisponible.");
        setErrorDiagnostics(
          buildAiDebugDetails(
            {
              errorCode: "NETWORK_ERROR",
              backendErrorCode: null,
              status: null,
              requestId: null,
            },
            { surface: "analysis" }
          )
        );
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
    errorDiagnostics,
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
