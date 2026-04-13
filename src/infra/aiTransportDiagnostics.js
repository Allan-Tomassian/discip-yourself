const ENV =
  typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
    ? import.meta.env
    : {};
let didLogAiBackendTarget = false;

function safeParseUrl(value) {
  try {
    return new URL(String(value || "").trim());
  } catch {
    return null;
  }
}

export function isPrivateIpv4Hostname(hostname) {
  const value = String(hostname || "").trim();
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 192 && second === 168) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  return false;
}

export function isPrivateNetworkOrigin(origin) {
  const url = safeParseUrl(origin);
  if (!url) return false;
  return isPrivateIpv4Hostname(url.hostname);
}

function readFrontendOrigin() {
  if (typeof window === "undefined" || !window.location?.origin) return "";
  return String(window.location.origin || "").trim();
}

function readAppEnv() {
  return String(ENV.VITE_APP_ENV || "").trim().toLowerCase() || "local";
}

function isCrossOrigin(frontendOrigin, backendBaseUrl) {
  const frontend = safeParseUrl(frontendOrigin);
  const backend = safeParseUrl(backendBaseUrl);
  if (!frontend || !backend) return false;
  return frontend.origin !== backend.origin;
}

function shouldLogAiTransportDebug() {
  const mode = String(ENV.MODE || "").trim().toLowerCase();
  if (mode === "test") return false;
  if (typeof window === "undefined") return false;
  const hostname = String(window.location?.hostname || "").trim();
  if (ENV.DEV) return true;
  return hostname === "localhost" || hostname === "127.0.0.1" || isPrivateIpv4Hostname(hostname);
}

export function shouldShowAiDebugUi() {
  return shouldLogAiTransportDebug();
}

export function buildAiTransportMeta({ baseUrl, errorCode = null } = {}) {
  const frontendOrigin = readFrontendOrigin();
  const backendBaseUrl = typeof baseUrl === "string" ? String(baseUrl).trim() : "";
  const online =
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : null;
  const normalizedCode = String(errorCode || "").trim().toUpperCase();

  let probableCause = null;
  if (normalizedCode === "NETWORK_ERROR") {
    if (online === false) probableCause = "offline";
    else if (
      frontendOrigin &&
      backendBaseUrl &&
      isPrivateNetworkOrigin(frontendOrigin) &&
      isCrossOrigin(frontendOrigin, backendBaseUrl)
    ) {
      probableCause = "cors_private_origin";
    } else {
      probableCause = "network_unknown";
    }
  }

  return {
    frontendOrigin,
    backendBaseUrl,
    online,
    probableCause,
  };
}

export function logAiTransportIssue({
  endpoint,
  errorCode = null,
  transportMeta = null,
  status = null,
  requestId = null,
  mode = null,
  backendErrorCode = null,
  responseKind = null,
  responseMode = null,
  bodyKeys = null,
} = {}) {
  if (!shouldLogAiTransportDebug()) return;
  const meta = transportMeta && typeof transportMeta === "object" ? transportMeta : {};
  // Dev-only network diagnostics for real-device debugging.
  console.warn("[ai-transport]", {
    appEnv: readAppEnv(),
    endpoint: String(endpoint || "").trim() || null,
    errorCode: String(errorCode || "").trim().toUpperCase() || null,
    backendErrorCode: String(backendErrorCode || "").trim().toUpperCase() || null,
    status: Number.isInteger(status) ? status : null,
    requestId: String(requestId || "").trim() || null,
    mode: String(mode || "").trim() || null,
    responseKind: String(responseKind || "").trim() || null,
    responseMode: String(responseMode || "").trim() || null,
    bodyKeys: Array.isArray(bodyKeys) ? bodyKeys : null,
    frontendOrigin: meta.frontendOrigin || "",
    backendBaseUrl: meta.backendBaseUrl || "",
    online: typeof meta.online === "boolean" ? meta.online : null,
    probableCause: meta.probableCause || null,
  });
}

export function logAiBackendTargetOnce({ backendBaseUrl } = {}) {
  if (didLogAiBackendTarget || !shouldLogAiTransportDebug()) return;
  didLogAiBackendTarget = true;
  const frontendOrigin = readFrontendOrigin();
  console.info("[ai-backend-target]", {
    appEnv: readAppEnv(),
    frontendOrigin: frontendOrigin || "",
    backendBaseUrl: String(backendBaseUrl || "").trim() || "",
  });
}

export function buildAiDebugLine(details = {}) {
  const errorCode = String(details?.errorCode || "").trim().toUpperCase();
  const backendErrorCode = String(details?.backendErrorCode || "").trim().toUpperCase();
  const requestId = String(details?.requestId || "").trim();
  const parts = [errorCode, backendErrorCode, requestId].filter(Boolean);
  return parts.length ? `IA_DEBUG: ${parts.join(" / ")}` : "";
}

export function buildAiDebugDetails(result = {}, { surface = null } = {}) {
  const transportMeta = result?.transportMeta && typeof result.transportMeta === "object" ? result.transportMeta : {};
  const resolvedSurface = String(result?.surface || surface || "").trim() || null;
  return {
    errorCode: String(result?.errorCode || "").trim().toUpperCase() || null,
    backendErrorCode: String(result?.backendErrorCode || "").trim().toUpperCase() || null,
    status: Number.isInteger(result?.status) ? result.status : null,
    requestId: String(result?.requestId || "").trim() || null,
    surface: resolvedSurface,
    probableCause: String(result?.probableCause || transportMeta?.probableCause || "").trim() || null,
    baseUrlUsed:
      String(result?.baseUrlUsed || transportMeta?.backendBaseUrl || "").trim() || null,
    originUsed:
      String(result?.originUsed || transportMeta?.frontendOrigin || "").trim() || null,
  };
}

export function deriveAiUnavailableMessage(
  result,
  {
    disabled,
    unauthorized,
    rateLimited,
    offline,
    corsPrivateOrigin,
    networkUnknown,
    fallback,
  }
) {
  const code = String(result?.errorCode || "").trim().toUpperCase();
  const probableCause = String(result?.transportMeta?.probableCause || "").trim().toLowerCase();

  if (code === "DISABLED") return disabled;
  if (code === "UNAUTHORIZED") return unauthorized;
  if (code === "RATE_LIMITED" || code === "QUOTA_EXCEEDED") return rateLimited;
  if (code === "NETWORK_ERROR") {
    if (probableCause === "offline") return offline;
    if (probableCause === "cors_private_origin") return corsPrivateOrigin;
    return networkUnknown;
  }
  return fallback;
}
