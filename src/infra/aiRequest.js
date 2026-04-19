function normalizeTimeoutMs(timeoutMs, fallbackMs) {
  if (Number.isFinite(timeoutMs)) return Math.max(250, Math.round(timeoutMs));
  if (Number.isFinite(fallbackMs)) return Math.max(250, Math.round(fallbackMs));
  return 0;
}

export function isAbortLikeError(error) {
  const name = String(error?.name || "").trim();
  const code = String(error?.code || "").trim().toUpperCase();
  return name === "AbortError" || code === "ABORT_ERR";
}

export async function fetchJsonWithTimeout({
  fetchImpl,
  url,
  options = {},
  timeoutMs,
  defaultTimeoutMs = 0,
} = {}) {
  const supportsAbortController = typeof AbortController === "function";
  const controller = supportsAbortController ? new AbortController() : null;
  const safeTimeoutMs = normalizeTimeoutMs(timeoutMs, defaultTimeoutMs);
  const timeoutId =
    controller && safeTimeoutMs > 0
      ? setTimeout(() => {
          controller.abort();
        }, safeTimeoutMs)
      : 0;

  try {
    const response = await fetchImpl(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
    });
    return {
      ok: true,
      response,
      timedOut: false,
      timeoutMs: safeTimeoutMs || null,
    };
  } catch (error) {
    return {
      ok: false,
      response: null,
      error,
      timedOut: Boolean(controller?.signal?.aborted) || isAbortLikeError(error),
      timeoutMs: safeTimeoutMs || null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
