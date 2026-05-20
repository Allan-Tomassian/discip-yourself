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
  signal,
  timeoutMs,
  defaultTimeoutMs = 0,
} = {}) {
  const supportsAbortController = typeof AbortController === "function";
  const controller = supportsAbortController ? new AbortController() : null;
  const externalSignal = signal || options.signal || null;
  let externallyAborted = Boolean(externalSignal?.aborted);
  const abortFromExternalSignal = () => {
    externallyAborted = true;
    controller?.abort();
  };
  if (controller && externalSignal?.addEventListener) {
    externalSignal.addEventListener("abort", abortFromExternalSignal, { once: true });
  }
  if (controller && externallyAborted) {
    controller.abort();
  }
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
      ...(controller ? { signal: controller.signal } : externalSignal ? { signal: externalSignal } : {}),
    });
    return {
      ok: true,
      response,
      timedOut: false,
      aborted: false,
      timeoutMs: safeTimeoutMs || null,
    };
  } catch (error) {
    const aborted = externallyAborted || Boolean(externalSignal?.aborted);
    return {
      ok: false,
      response: null,
      error,
      timedOut: !aborted && (Boolean(controller?.signal?.aborted) || isAbortLikeError(error)),
      aborted,
      timeoutMs: safeTimeoutMs || null,
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (controller && externalSignal?.removeEventListener) {
      externalSignal.removeEventListener("abort", abortFromExternalSignal);
    }
  }
}
