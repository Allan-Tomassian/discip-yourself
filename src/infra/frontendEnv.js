const ENV =
  typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
    ? import.meta.env
    : {};
const PROCESS_ENV =
  typeof globalThis !== "undefined"
  && globalThis.process
  && typeof globalThis.process === "object"
  && globalThis.process.env
  && typeof globalThis.process.env === "object"
    ? globalThis.process.env
    : {};

export const FRONTEND_REQUIRED_ENV_FILE = ".env.local";
export const FRONTEND_SUPABASE_REQUIRED_ENV_NAMES = Object.freeze([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
]);
export const FRONTEND_SUPABASE_LEGACY_ENV_NAME = "VITE_SUPABASE_ANON_KEY";
export const SUPABASE_ENV_ERROR_MESSAGE =
  "Frontend env invalid: fill .env.local with VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.";
export const AI_BACKEND_ENV_ERROR_MESSAGE =
  "Frontend env invalid: VITE_AI_BACKEND_URL must be an absolute http(s) URL.";

const SUPABASE_URL_RE = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i;
const SUPABASE_PUBLISHABLE_KEY_RE = /^sb_publishable_[a-z0-9._-]+$/i;

let didLogFrontendEnvIssues = false;

function readFirstDefinedValue(names = []) {
  for (const name of names) {
    const importValue = ENV[name];
    if (typeof importValue === "string" && importValue.trim()) return importValue;
    const processValue = PROCESS_ENV[name];
    if (typeof processValue === "string" && processValue.trim()) return processValue;
  }
  return "";
}

function hasNamedValue(name) {
  return Boolean(
    (typeof ENV[name] === "string" && ENV[name].trim()) || (typeof PROCESS_ENV[name] === "string" && PROCESS_ENV[name].trim())
  );
}

function isPrivateIpv4Hostname(hostname) {
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

function isLoopbackHostname(hostname) {
  const value = String(hostname || "").trim().toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "[::1]";
}

function isLocalDevHostname(hostname) {
  const value = String(hostname || "").trim().toLowerCase();
  return isLoopbackHostname(value) || isPrivateIpv4Hostname(value) || value.endsWith(".local");
}

function isPlaceholderValue(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return true;
  const lower = value.toLowerCase();
  return (
    lower.includes("<") ||
    lower.includes(">") ||
    lower.startsWith("your-") ||
    lower.startsWith("example") ||
    lower.includes("example-project-ref") ||
    lower.includes("placeholder") ||
    lower.includes("replace") ||
    lower.includes("insert") ||
    lower.includes("changeme")
  );
}

export function readFrontendAppEnv() {
  return String(readFirstDefinedValue(["VITE_APP_ENV"]) || "").trim().toLowerCase() || "local";
}

export function validateSupabaseUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (isPlaceholderValue(value) || !SUPABASE_URL_RE.test(value)) {
    const error = new Error(SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_URL_INVALID";
    throw error;
  }
  return value;
}

export function validateSupabasePublishableKey(rawKey) {
  const value = String(rawKey || "").trim();
  const isPublishable = SUPABASE_PUBLISHABLE_KEY_RE.test(value);
  const isJwt = value.startsWith("eyJ");

  if (isPlaceholderValue(value) || (!isPublishable && !isJwt)) {
    const error = new Error(SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_PUBLISHABLE_KEY_INVALID";
    throw error;
  }
  return value;
}

export const validateSupabaseAnonKey = validateSupabasePublishableKey;

export function validateSupabaseEnv(rawUrl, rawPublishableKey) {
  const url = validateSupabaseUrl(rawUrl);
  const publishableKey = validateSupabasePublishableKey(rawPublishableKey);
  return { url, publishableKey, anonKey: publishableKey };
}

export function getSupabaseProjectRef(rawUrl) {
  const url = validateSupabaseUrl(rawUrl);
  const match = SUPABASE_URL_RE.exec(url);
  const projectRef = match?.[1] || "";
  if (!projectRef) {
    const error = new Error(SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_PROJECT_REF_INVALID";
    throw error;
  }
  return projectRef;
}

export function normalizeBaseUrl(rawValue) {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function resolveAiBackendDevPort() {
  const value = String(readFirstDefinedValue(["VITE_AI_BACKEND_PORT"]) || "").trim();
  const numeric = Number.parseInt(value, 10);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 65535) {
    return String(numeric);
  }
  return "3001";
}

export function inferLocalAiBackendBaseUrl() {
  if (typeof window === "undefined" || !window.location) return "";
  const appEnv = readFrontendAppEnv();
  const isDevLike = ENV.DEV || appEnv === "local" || appEnv === "test";
  if (!isDevLike) return "";

  const hostname = String(window.location.hostname || "").trim();
  if (!isLocalDevHostname(hostname)) return "";

  return normalizeBaseUrl(`http://${hostname}:${resolveAiBackendDevPort()}`);
}

export function readAiBackendBaseUrl(rawValue) {
  if (typeof rawValue === "string") return normalizeBaseUrl(rawValue);
  const explicitValue = String(readFirstDefinedValue(["VITE_AI_BACKEND_URL"]) || "").trim();
  if (explicitValue) return normalizeBaseUrl(explicitValue);
  return inferLocalAiBackendBaseUrl();
}

export function readFrontendRuntimeEnv() {
  const supabaseUrl = String(readFirstDefinedValue(["VITE_SUPABASE_URL", "E2E_SUPABASE_URL"]) || "").trim();
  const supabasePublishableKey = String(
    readFirstDefinedValue([
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "E2E_SUPABASE_PUBLISHABLE_KEY",
      FRONTEND_SUPABASE_LEGACY_ENV_NAME,
      "E2E_SUPABASE_ANON_KEY",
    ]) || ""
  ).trim();
  const rawAiBackendUrl = String(readFirstDefinedValue(["VITE_AI_BACKEND_URL"]) || "").trim();
  const aiBackendBaseUrl = rawAiBackendUrl ? normalizeBaseUrl(rawAiBackendUrl) : inferLocalAiBackendBaseUrl();

  let supabaseConfigError = "";
  try {
    validateSupabaseEnv(supabaseUrl, supabasePublishableKey);
  } catch (error) {
    supabaseConfigError = error?.message || SUPABASE_ENV_ERROR_MESSAGE;
  }

  return {
    appEnv: readFrontendAppEnv(),
    supabaseUrl,
    supabasePublishableKey,
    supabaseAnonKey: supabasePublishableKey,
    aiBackendBaseUrl,
    supabaseConfigError,
    aiBackendConfigError: rawAiBackendUrl && !aiBackendBaseUrl ? AI_BACKEND_ENV_ERROR_MESSAGE : "",
    usingLegacySupabaseAnonKey:
      !hasNamedValue("VITE_SUPABASE_PUBLISHABLE_KEY") && hasNamedValue(FRONTEND_SUPABASE_LEGACY_ENV_NAME),
  };
}

export function requireFrontendSupabaseEnv() {
  const runtimeEnv = readFrontendRuntimeEnv();
  if (runtimeEnv.supabaseConfigError) {
    const error = new Error(runtimeEnv.supabaseConfigError);
    error.code = "FRONTEND_SUPABASE_ENV_INVALID";
    throw error;
  }
  return runtimeEnv;
}

export function logFrontendRuntimeEnvIssues(runtimeEnv = readFrontendRuntimeEnv()) {
  if (didLogFrontendEnvIssues) return runtimeEnv;
  didLogFrontendEnvIssues = true;

  if (runtimeEnv.supabaseConfigError) {
    // eslint-disable-next-line no-console
    console.error("[env] Frontend Supabase config invalid.", {
      expectedFile: FRONTEND_REQUIRED_ENV_FILE,
      requiredVars: FRONTEND_SUPABASE_REQUIRED_ENV_NAMES,
      legacyAlias: FRONTEND_SUPABASE_LEGACY_ENV_NAME,
      message: runtimeEnv.supabaseConfigError,
    });
  }

  if (runtimeEnv.aiBackendConfigError) {
    // eslint-disable-next-line no-console
    console.error("[env] Frontend AI backend config invalid.", {
      expectedFile: FRONTEND_REQUIRED_ENV_FILE,
      requiredVars: ["VITE_AI_BACKEND_URL"],
      message: runtimeEnv.aiBackendConfigError,
    });
  }

  return runtimeEnv;
}
