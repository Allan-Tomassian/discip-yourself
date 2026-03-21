import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { requestAiNow, isAiBackendConfigured } from "../infra/aiNowClient";
import { todayLocalKey } from "../utils/dateKey";

const aiNowCache = new Map();
const AI_NOW_CACHE_LIMIT = 24;
export const AI_NOW_CACHE_TTL_MS = 60 * 1000;

function setCachedValue(key, value) {
  if (!key) return;
  if (aiNowCache.has(key)) aiNowCache.delete(key);
  aiNowCache.set(key, value);
  while (aiNowCache.size > AI_NOW_CACHE_LIMIT) {
    const oldestKey = aiNowCache.keys().next().value;
    aiNowCache.delete(oldestKey);
  }
}

export function resetAiNowCacheForTests() {
  aiNowCache.clear();
}

function serializeSessionSignature(session, { includeRuntimePhase = false } = {}) {
  if (!session || typeof session !== "object") return "";
  const parts = [
    session.id || "",
    session.occurrenceId || "",
    session.dateKey || session.date || "",
  ];
  if (includeRuntimePhase) {
    parts.push(session.runtimePhase || "");
  }
  return parts.join(":");
}

function serializeOccurrenceSignature(occurrence) {
  if (!occurrence || typeof occurrence !== "object") return "";
  return [
    occurrence.id || "",
    occurrence.date || "",
    occurrence.status || "",
    occurrence.start || occurrence.slotKey || "",
  ].join(":");
}

export function createAiNowContextSignature({
  activeDate = "",
  activeCategoryId = null,
  activeSessionForActiveDate = null,
  openSessionOutsideActiveDate = null,
  futureSessions = [],
  focusOccurrenceForActiveDate = null,
  plannedActionsForActiveDate = [],
}) {
  const futureSessionSignature = (Array.isArray(futureSessions) ? futureSessions : [])
    .map((session) => serializeSessionSignature(session))
    .filter(Boolean)
    .sort()
    .join(",");
  const plannedActionSignature = (Array.isArray(plannedActionsForActiveDate) ? plannedActionsForActiveDate : [])
    .map((occurrence) => serializeOccurrenceSignature(occurrence))
    .filter(Boolean)
    .sort()
    .join(",");

  return [
    activeDate || "",
    activeCategoryId || "",
    serializeSessionSignature(activeSessionForActiveDate, { includeRuntimePhase: true }),
    serializeSessionSignature(openSessionOutsideActiveDate),
    futureSessionSignature,
    serializeOccurrenceSignature(focusOccurrenceForActiveDate),
    plannedActionSignature,
  ].join("|");
}

export function isAiNowCacheFresh(entry, nowMs = Date.now()) {
  if (!entry || !Number.isFinite(entry.fetchedAt)) return false;
  return nowMs - entry.fetchedAt < AI_NOW_CACHE_TTL_MS;
}

export function getAiNowEligibility({
  enabled,
  isAuthenticated,
  selectedDateKey,
  backendConfigured,
  accessToken,
}) {
  if (!backendConfigured) {
    return { shouldFetch: false, state: "disabled", reason: "backend_disabled" };
  }
  if (enabled !== true) {
    return { shouldFetch: false, state: "idle", reason: "feature_disabled" };
  }
  if (!isAuthenticated || !String(accessToken || "").trim()) {
    return { shouldFetch: false, state: "idle", reason: "unauthenticated" };
  }
  if (selectedDateKey !== todayLocalKey()) {
    return { shouldFetch: false, state: "idle", reason: "not_today" };
  }
  return { shouldFetch: true, state: "idle", reason: "ready" };
}

export function resolveAiNowTrigger({
  previous = null,
  eligibilityDidBecomeReady = false,
  selectedDateKey,
  activeCategoryId = null,
  activeSessionId = null,
  contextSignature = "",
}) {
  const prev = previous && typeof previous === "object" ? previous : {};
  if (eligibilityDidBecomeReady || !prev.initialized || prev.shouldFetch !== true) {
    return activeSessionId ? "resume" : "screen_open";
  }
  if ((activeSessionId || null) !== (prev.activeSessionId || null)) {
    return activeSessionId ? "resume" : "screen_open";
  }
  if (selectedDateKey !== prev.selectedDateKey) {
    return "screen_open";
  }
  if ((activeCategoryId || null) !== (prev.activeCategoryId || null)) {
    return "screen_open";
  }
  if ((contextSignature || "") !== (prev.contextSignature || "")) {
    return "screen_open";
  }
  return null;
}

export function createAiNowRequestKey({
  selectedDateKey,
  activeCategoryId = null,
  activeSessionId = null,
  trigger,
  contextSignature = "",
}) {
  return [selectedDateKey || "", activeCategoryId || "", activeSessionId || "", trigger || "", contextSignature || ""].join("|");
}

export function deriveAiNowRequestDiagnostics({
  state,
  errorCode = null,
  coach = null,
  deliverySource = null,
  isRefreshing = false,
  hadVisibleLoading = false,
  fetchedAt = null,
}) {
  if (state === "loading") {
    return {
      requestState: "loading",
      errorCode: null,
      backendDiagnostics: null,
      deliverySource: null,
      isRefreshing: false,
      hadVisibleLoading: false,
      fetchedAt: null,
    };
  }
  if (state === "success") {
    return {
      requestState: "success",
      errorCode: null,
      backendDiagnostics: coach?.meta?.diagnostics || null,
      deliverySource: deliverySource || null,
      isRefreshing: Boolean(isRefreshing),
      hadVisibleLoading: Boolean(hadVisibleLoading),
      fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : null,
    };
  }
  if (state === "error") {
    return {
      requestState: "error",
      errorCode: errorCode || null,
      backendDiagnostics: null,
      deliverySource: null,
      isRefreshing: false,
      hadVisibleLoading: false,
      fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : null,
    };
  }
  if (state === "disabled") {
    return {
      requestState: "disabled",
      errorCode: errorCode || "DISABLED",
      backendDiagnostics: null,
      deliverySource: null,
      isRefreshing: false,
      hadVisibleLoading: false,
      fetchedAt: null,
    };
  }
  return {
    requestState: "idle",
    errorCode: errorCode || null,
    backendDiagnostics: null,
    deliverySource: null,
    isRefreshing: false,
    hadVisibleLoading: false,
    fetchedAt: null,
  };
}

export function useAiNow({
  selectedDateKey,
  activeCategoryId = null,
  activeSessionId = null,
  contextSignature = "",
  isAuthenticated = false,
  enabled = false,
}) {
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const backendConfigured = isAiBackendConfigured();
  const [state, setState] = useState(backendConfigured ? "idle" : "disabled");
  const [coach, setCoach] = useState(null);
  const [errorCode, setErrorCode] = useState(backendConfigured ? null : "DISABLED");
  const [requestMeta, setRequestMeta] = useState({
    deliverySource: null,
    isRefreshing: false,
    hadVisibleLoading: false,
    fetchedAt: null,
  });
  const [visibilityTick, setVisibilityTick] = useState(0);
  const previousInputsRef = useRef({ initialized: false });
  const inFlightKeyRef = useRef("");

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      setVisibilityTick(Date.now());
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const eligibility = getAiNowEligibility({
      enabled,
      isAuthenticated,
      selectedDateKey,
      backendConfigured,
      accessToken,
    });

    const currentInputs = {
      initialized: true,
      shouldFetch: eligibility.shouldFetch,
      selectedDateKey,
      activeCategoryId: activeCategoryId || null,
      activeSessionId: activeSessionId || null,
      contextSignature: contextSignature || "",
      visibilityTick,
    };

    if (!eligibility.shouldFetch) {
      previousInputsRef.current = currentInputs;
      setCoach(null);
      setErrorCode(eligibility.state === "disabled" ? "DISABLED" : null);
      setState(eligibility.state);
      setRequestMeta({
        deliverySource: null,
        isRefreshing: false,
        hadVisibleLoading: false,
        fetchedAt: null,
      });
      return undefined;
    }

    const previousInputs = previousInputsRef.current;
    let trigger = resolveAiNowTrigger({
      previous: previousInputs,
      eligibilityDidBecomeReady: eligibility.shouldFetch && previousInputs?.shouldFetch !== true,
      selectedDateKey,
      activeCategoryId,
      activeSessionId,
      contextSignature,
    });
    if (!trigger) {
      const visibilityRefreshKey = createAiNowRequestKey({
        selectedDateKey,
        activeCategoryId,
        activeSessionId,
        trigger: "screen_open",
        contextSignature,
      });
      const cachedForVisibilityRefresh = aiNowCache.get(visibilityRefreshKey);
      const visibilityChanged = currentInputs.visibilityTick !== (previousInputs?.visibilityTick || 0);
      if (visibilityChanged && cachedForVisibilityRefresh && !isAiNowCacheFresh(cachedForVisibilityRefresh)) {
        trigger = "screen_open";
      }
    }
    previousInputsRef.current = currentInputs;
    if (!trigger) return undefined;

    const requestKey = createAiNowRequestKey({
      selectedDateKey,
      activeCategoryId,
      activeSessionId,
      trigger,
      contextSignature,
    });

    const cached = aiNowCache.get(requestKey);
    if (cached && isAiNowCacheFresh(cached)) {
      setCoach(cached.coach || null);
      setErrorCode(cached.errorCode || null);
      setState(cached.state || "idle");
      setRequestMeta({
        deliverySource: "cache",
        isRefreshing: false,
        hadVisibleLoading: false,
        fetchedAt: cached.fetchedAt || null,
      });
      return undefined;
    }

    inFlightKeyRef.current = requestKey;
    let cancelled = false;
    const canReuseStaleSuccess = cached?.state === "success" && cached?.coach;
    if (canReuseStaleSuccess) {
      setCoach(cached.coach || null);
      setErrorCode(null);
      setState("success");
      setRequestMeta({
        deliverySource: "cache",
        isRefreshing: true,
        hadVisibleLoading: false,
        fetchedAt: cached.fetchedAt || null,
      });
    } else {
      setCoach(null);
      setState("loading");
      setErrorCode(null);
      setRequestMeta({
        deliverySource: null,
        isRefreshing: false,
        hadVisibleLoading: false,
        fetchedAt: null,
      });
    }

    requestAiNow({
      accessToken,
      payload: {
        selectedDateKey,
        activeCategoryId,
        surface: "today",
        trigger,
      },
    }).then((result) => {
      if (cancelled || inFlightKeyRef.current !== requestKey) return;
      if (result.ok) {
        const fetchedAt = Date.now();
        const cachedValue = {
          state: "success",
          coach: result.coach,
          errorCode: null,
          fetchedAt,
        };
        setCachedValue(requestKey, cachedValue);
        setCoach(result.coach);
        setErrorCode(null);
        setState("success");
        setRequestMeta({
          deliverySource: "network",
          isRefreshing: false,
          hadVisibleLoading: !canReuseStaleSuccess,
          fetchedAt,
        });
        return;
      }

      if (canReuseStaleSuccess) {
        setRequestMeta((current) => ({
          ...current,
          isRefreshing: false,
        }));
        return;
      }

      const fetchedAt = Date.now();
      const cachedValue = {
        state: "error",
        coach: null,
        errorCode: result.errorCode,
        fetchedAt,
      };
      setCachedValue(requestKey, cachedValue);
      setCoach(null);
      setErrorCode(result.errorCode);
      setState("error");
      setRequestMeta({
        deliverySource: null,
        isRefreshing: false,
        hadVisibleLoading: false,
        fetchedAt,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    activeCategoryId,
    activeSessionId,
    backendConfigured,
    contextSignature,
    enabled,
    isAuthenticated,
    selectedDateKey,
    visibilityTick,
  ]);

  return {
    state,
    coach,
    errorCode,
    isConfigured: backendConfigured,
    requestDiagnostics: deriveAiNowRequestDiagnostics({
      state,
      errorCode,
      coach,
      deliverySource: requestMeta.deliverySource,
      isRefreshing: requestMeta.isRefreshing,
      hadVisibleLoading: requestMeta.hadVisibleLoading,
      fetchedAt: requestMeta.fetchedAt,
    }),
  };
}
