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
  status = null,
  state,
  errorCode = null,
  coach = null,
  deliverySource = null,
  isRefreshing = false,
  hadVisibleLoading = false,
  fetchedAt = null,
}) {
  const normalizedState = status || state || "idle";

  if (normalizedState === "loading") {
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
  if (normalizedState === "success" || normalizedState === "fresh" || normalizedState === "stale") {
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
  if (normalizedState === "error") {
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
  if (normalizedState === "disabled") {
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

function resetPublicRequestMeta() {
  return {
    deliverySource: null,
    isRefreshing: false,
    hadVisibleLoading: false,
    fetchedAt: null,
  };
}

function buildHardResetState(errorCode = null) {
  return {
    status: "idle",
    coach: null,
    errorCode,
    hasEverLoaded: false,
    lastSuccessfulCoach: null,
    lastSuccessfulFetchedAt: null,
    isRefreshingInBackground: false,
    requestMeta: resetPublicRequestMeta(),
  };
}

function toLegacyState({ status, isConfigured }) {
  if (!isConfigured) return "disabled";
  if (status === "fresh" || status === "stale") return "success";
  if (status === "loading") return "loading";
  if (status === "error") return "error";
  return "idle";
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
  const userId = session?.user?.id || "";
  const backendConfigured = isAiBackendConfigured();
  const [status, setStatus] = useState("idle");
  const [coach, setCoach] = useState(null);
  const [hasEverLoaded, setHasEverLoaded] = useState(false);
  const [lastSuccessfulCoach, setLastSuccessfulCoach] = useState(null);
  const [lastSuccessfulFetchedAt, setLastSuccessfulFetchedAt] = useState(null);
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
  const previousTransitionRef = useRef({ status: "idle", isRefreshing: false });
  const previousUserIdRef = useRef(userId);

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
    if (!import.meta.env?.DEV) return;
    const previous = previousTransitionRef.current;
    if (previous.status === status && previous.isRefreshing === requestMeta.isRefreshing) return;
    // eslint-disable-next-line no-console
    console.debug("[ai-now]", `${previous.status}${previous.isRefreshing ? " -> refreshing" : ""} -> ${status}${requestMeta.isRefreshing ? " -> refreshing" : ""}`);
    previousTransitionRef.current = {
      status,
      isRefreshing: requestMeta.isRefreshing,
    };
  }, [requestMeta.isRefreshing, status]);

  useEffect(() => {
    const eligibility = getAiNowEligibility({
      enabled,
      isAuthenticated,
      selectedDateKey,
      backendConfigured,
      accessToken,
    });
    const userChanged = previousUserIdRef.current !== userId;
    if (userChanged) {
      previousUserIdRef.current = userId;
    }

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
      const shouldHardReset =
        userChanged ||
        eligibility.reason === "backend_disabled" ||
        eligibility.reason === "unauthenticated" ||
        eligibility.reason === "not_today";
      if (shouldHardReset) {
        const next = buildHardResetState(eligibility.state === "disabled" ? "DISABLED" : null);
        setCoach(next.coach);
        setStatus(next.status);
        setErrorCode(next.errorCode);
        setHasEverLoaded(next.hasEverLoaded);
        setLastSuccessfulCoach(next.lastSuccessfulCoach);
        setLastSuccessfulFetchedAt(next.lastSuccessfulFetchedAt);
        setRequestMeta(next.requestMeta);
      } else {
        setStatus("idle");
        setRequestMeta(resetPublicRequestMeta());
      }
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
      const freshCoach = cached.state === "success" && cached.coach ? cached.coach : null;
      const visibleCoach = freshCoach || lastSuccessfulCoach || null;
      if (freshCoach) {
        setCoach(freshCoach);
        setLastSuccessfulCoach(freshCoach);
        setLastSuccessfulFetchedAt(cached.fetchedAt || null);
        setHasEverLoaded(true);
        setStatus("fresh");
        setErrorCode(null);
      } else if (visibleCoach) {
        setCoach(visibleCoach);
        setStatus("stale");
        setErrorCode(cached.errorCode || null);
      } else {
        setCoach(null);
        setStatus(cached.state === "error" ? "error" : "idle");
        setErrorCode(cached.errorCode || null);
      }
      setRequestMeta({
        deliverySource: "cache",
        isRefreshing: false,
        hadVisibleLoading: false,
        fetchedAt: cached.fetchedAt || lastSuccessfulFetchedAt || null,
      });
      return undefined;
    }

    inFlightKeyRef.current = requestKey;
    let cancelled = false;
    const staleCoach = cached?.state === "success" && cached?.coach ? cached.coach : lastSuccessfulCoach;
    const canReuseStaleSuccess = Boolean(staleCoach);
    if (canReuseStaleSuccess) {
      setCoach(staleCoach || null);
      setHasEverLoaded(true);
      setErrorCode(null);
      setStatus("stale");
      setRequestMeta({
        deliverySource: cached?.state === "success" ? "cache" : requestMeta.deliverySource,
        isRefreshing: true,
        hadVisibleLoading: false,
        fetchedAt: cached?.fetchedAt || lastSuccessfulFetchedAt || null,
      });
    } else {
      setStatus("loading");
      setErrorCode(null);
      setRequestMeta(resetPublicRequestMeta());
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
        setLastSuccessfulCoach(result.coach);
        setLastSuccessfulFetchedAt(fetchedAt);
        setHasEverLoaded(true);
        setErrorCode(null);
        setStatus("fresh");
        setRequestMeta({
          deliverySource: "network",
          isRefreshing: false,
          hadVisibleLoading: !canReuseStaleSuccess,
          fetchedAt,
        });
        return;
      }

      if (canReuseStaleSuccess) {
        setStatus("stale");
        setErrorCode(result.errorCode || null);
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
      setStatus("error");
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
    lastSuccessfulCoach,
    lastSuccessfulFetchedAt,
    selectedDateKey,
    userId,
    visibilityTick,
  ]);

  const state = toLegacyState({ status, isConfigured: backendConfigured });

  return {
    status,
    state,
    coach,
    errorCode,
    isConfigured: backendConfigured,
    hasEverLoaded,
    isRefreshingInBackground: requestMeta.isRefreshing,
    lastSuccessfulCoach,
    lastSuccessfulFetchedAt,
    requestDiagnostics: deriveAiNowRequestDiagnostics({
      status,
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
