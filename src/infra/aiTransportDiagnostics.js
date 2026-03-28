const ENV =
  typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
    ? import.meta.env
    : {};
const PROCESS_ENV =
  typeof process !== "undefined" && process.env && typeof process.env === "object"
    ? process.env
    : {};

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

function isCrossOrigin(frontendOrigin, backendBaseUrl) {
  const frontend = safeParseUrl(frontendOrigin);
  const backend = safeParseUrl(backendBaseUrl);
  if (!frontend || !backend) return false;
  return frontend.origin !== backend.origin;
}

function shouldLogAiTransportDebug() {
  const mode = String(ENV.MODE || PROCESS_ENV.NODE_ENV || "").trim().toLowerCase();
  const isVitest = String(PROCESS_ENV.VITEST || "").trim().toLowerCase() === "true";
  if (isVitest || mode === "test") return false;
  if (typeof window === "undefined") return false;
  const hostname = String(window.location?.hostname || "").trim();
  if (ENV.DEV) return true;
  return hostname === "localhost" || hostname === "127.0.0.1" || isPrivateIpv4Hostname(hostname);
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

export function logAiTransportIssue({ endpoint, errorCode = null, transportMeta = null } = {}) {
  if (!shouldLogAiTransportDebug()) return;
  const meta = transportMeta && typeof transportMeta === "object" ? transportMeta : {};
  // Dev-only network diagnostics for real-device debugging.
  console.warn("[ai-transport]", {
    endpoint: String(endpoint || "").trim() || null,
    errorCode: String(errorCode || "").trim().toUpperCase() || null,
    frontendOrigin: meta.frontendOrigin || "",
    backendBaseUrl: meta.backendBaseUrl || "",
    online: typeof meta.online === "boolean" ? meta.online : null,
    probableCause: meta.probableCause || null,
  });
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
