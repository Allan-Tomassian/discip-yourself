import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { requestAiNow, isAiBackendConfigured } from "../infra/aiNowClient";
import { todayLocalKey } from "../utils/dateKey";

const aiNowCache = new Map();
const AI_NOW_CACHE_LIMIT = 24;

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
  selectedDateKey,
  activeCategoryId = null,
  activeSessionId = null,
}) {
  const prev = previous && typeof previous === "object" ? previous : {};
  if (!prev.initialized) {
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
  return null;
}

export function createAiNowRequestKey({
  selectedDateKey,
  activeCategoryId = null,
  activeSessionId = null,
  trigger,
}) {
  return [selectedDateKey || "", activeCategoryId || "", activeSessionId || "", trigger || ""].join("|");
}

export function deriveAiNowRequestDiagnostics({ state, errorCode = null, coach = null }) {
  if (state === "loading") {
    return {
      requestState: "loading",
      errorCode: null,
      backendDiagnostics: null,
    };
  }
  if (state === "success") {
    return {
      requestState: "success",
      errorCode: null,
      backendDiagnostics: coach?.meta?.diagnostics || null,
    };
  }
  if (state === "error") {
    return {
      requestState: "error",
      errorCode: errorCode || null,
      backendDiagnostics: null,
    };
  }
  if (state === "disabled") {
    return {
      requestState: "disabled",
      errorCode: errorCode || "DISABLED",
      backendDiagnostics: null,
    };
  }
  return {
    requestState: "idle",
    errorCode: errorCode || null,
    backendDiagnostics: null,
  };
}

export function useAiNow({
  selectedDateKey,
  activeCategoryId = null,
  activeSessionId = null,
  isAuthenticated = false,
  enabled = false,
}) {
  const { session } = useAuth();
  const accessToken = session?.access_token || "";
  const backendConfigured = isAiBackendConfigured();
  const [state, setState] = useState(backendConfigured ? "idle" : "disabled");
  const [coach, setCoach] = useState(null);
  const [errorCode, setErrorCode] = useState(backendConfigured ? null : "DISABLED");
  const previousInputsRef = useRef({ initialized: false });
  const inFlightKeyRef = useRef("");

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
      selectedDateKey,
      activeCategoryId: activeCategoryId || null,
      activeSessionId: activeSessionId || null,
    };

    if (!eligibility.shouldFetch) {
      previousInputsRef.current = currentInputs;
      setCoach(null);
      setErrorCode(eligibility.state === "disabled" ? "DISABLED" : null);
      setState(eligibility.state);
      return undefined;
    }

    const trigger = resolveAiNowTrigger({
      previous: previousInputsRef.current,
      selectedDateKey,
      activeCategoryId,
      activeSessionId,
    });
    previousInputsRef.current = currentInputs;
    if (!trigger) return undefined;

    const requestKey = createAiNowRequestKey({
      selectedDateKey,
      activeCategoryId,
      activeSessionId,
      trigger,
    });

    const cached = aiNowCache.get(requestKey);
    if (cached) {
      setCoach(cached.coach || null);
      setErrorCode(cached.errorCode || null);
      setState(cached.state || "idle");
      return undefined;
    }

    inFlightKeyRef.current = requestKey;
    let cancelled = false;
    setState("loading");
    setErrorCode(null);

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
      const nextState = result.ok ? "success" : "error";
      const cachedValue = {
        state: nextState,
        coach: result.ok ? result.coach : null,
        errorCode: result.ok ? null : result.errorCode,
      };
      setCachedValue(requestKey, cachedValue);
      setCoach(cachedValue.coach);
      setErrorCode(cachedValue.errorCode);
      setState(nextState);
    });

    return () => {
      cancelled = true;
    };
  }, [accessToken, activeCategoryId, activeSessionId, backendConfigured, enabled, isAuthenticated, selectedDateKey]);

  return {
    state,
    coach,
    errorCode,
    isConfigured: backendConfigured,
    requestDiagnostics: deriveAiNowRequestDiagnostics({
      state,
      errorCode,
      coach,
    }),
  };
}
