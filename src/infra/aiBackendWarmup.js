import { fetchJsonWithTimeout } from "./aiRequest";

export const AI_BACKEND_WARMUP_TIMEOUT_MS = 30000;
export const AI_BACKEND_WARMUP_STALE_TTL_MS = 10 * 60 * 1000;

function createInitialWarmupState() {
  return {
    backendBaseUrl: "",
    lastHealthyAt: null,
    lastWakeAttemptAt: null,
    lastWakeDurationMs: null,
    wakeState: "idle",
  };
}

let warmupState = createInitialWarmupState();
let inFlightWarmup = null;
let inFlightBaseUrl = "";

function isBrowserWarmupContext() {
  return typeof window !== "undefined";
}

function normalizeTimestamp(value) {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
}

function cloneWarmupState() {
  return {
    lastHealthyAt: normalizeTimestamp(warmupState.lastHealthyAt),
    lastWakeAttemptAt: normalizeTimestamp(warmupState.lastWakeAttemptAt),
    lastWakeDurationMs: normalizeTimestamp(warmupState.lastWakeDurationMs),
    wakeState: String(warmupState.wakeState || "idle").trim() || "idle",
  };
}

function updateWarmupState(patch = {}) {
  warmupState = {
    ...warmupState,
    ...patch,
  };
  return cloneWarmupState();
}

export function getAiBackendWarmupState() {
  return cloneWarmupState();
}

export function resetAiBackendWarmupStateForTests() {
  warmupState = createInitialWarmupState();
  inFlightWarmup = null;
  inFlightBaseUrl = "";
}

export function shouldWarmAiBackend({
  baseUrl,
  nowMs = Date.now(),
  ttlMs = AI_BACKEND_WARMUP_STALE_TTL_MS,
} = {}) {
  if (!isBrowserWarmupContext()) return false;
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!normalizedBaseUrl) return false;
  if (warmupState.backendBaseUrl && warmupState.backendBaseUrl !== normalizedBaseUrl) return true;
  if (!Number.isFinite(warmupState.lastHealthyAt)) return true;
  const safeTtlMs = Number.isFinite(ttlMs) ? Math.max(0, Math.round(ttlMs)) : AI_BACKEND_WARMUP_STALE_TTL_MS;
  return nowMs - warmupState.lastHealthyAt >= safeTtlMs;
}

async function readWarmupBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function ensureAiBackendWarm({
  baseUrl,
  fetchImpl = globalThis.fetch,
  timeoutMs = AI_BACKEND_WARMUP_TIMEOUT_MS,
  ttlMs = AI_BACKEND_WARMUP_STALE_TTL_MS,
} = {}) {
  const normalizedBaseUrl = String(baseUrl || "").trim();
  if (!normalizedBaseUrl || typeof fetchImpl !== "function") {
    return {
      ok: true,
      skipped: true,
      reason: "invalid_input",
      state: getAiBackendWarmupState(),
    };
  }

  if (!shouldWarmAiBackend({ baseUrl: normalizedBaseUrl, ttlMs })) {
    return {
      ok: true,
      skipped: true,
      reason: "fresh",
      state: getAiBackendWarmupState(),
    };
  }

  if (inFlightWarmup && inFlightBaseUrl === normalizedBaseUrl) {
    return inFlightWarmup;
  }

  const startedAt = Date.now();
  updateWarmupState({
    backendBaseUrl: normalizedBaseUrl,
    lastWakeAttemptAt: startedAt,
    wakeState: "warming",
  });

  inFlightBaseUrl = normalizedBaseUrl;
  inFlightWarmup = (async () => {
    const requestResult = await fetchJsonWithTimeout({
      fetchImpl,
      url: `${normalizedBaseUrl}/health`,
      timeoutMs,
      defaultTimeoutMs: AI_BACKEND_WARMUP_TIMEOUT_MS,
      options: {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    });

    const durationMs = Math.max(0, Date.now() - startedAt);

    if (!requestResult.ok) {
      return {
        ok: false,
        skipped: false,
        errorCode: requestResult.timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        probableCause: requestResult.timedOut ? "backend_waking" : null,
        state: updateWarmupState({
          lastWakeDurationMs: durationMs,
          wakeState: requestResult.timedOut ? "timeout" : "unavailable",
        }),
      };
    }

    const response = requestResult.response;
    const body = await readWarmupBody(response);
    if (!response.ok || body?.ok !== true) {
      return {
        ok: false,
        skipped: false,
        errorCode: "BACKEND_UNAVAILABLE",
        probableCause: null,
        status: Number.isInteger(response?.status) ? response.status : null,
        state: updateWarmupState({
          lastWakeDurationMs: durationMs,
          wakeState: "unavailable",
        }),
      };
    }

    const healthyAt = Date.now();
    return {
      ok: true,
      skipped: false,
      durationMs,
      state: updateWarmupState({
        lastHealthyAt: healthyAt,
        lastWakeDurationMs: durationMs,
        wakeState: "healthy",
      }),
    };
  })().finally(() => {
    inFlightWarmup = null;
    inFlightBaseUrl = "";
  });

  return inFlightWarmup;
}
