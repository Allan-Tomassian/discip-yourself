import { inferLocalAiBackendBaseUrl, normalizeBaseUrl } from "./frontendEnv";

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

export const API_PROXY_PREFIX = "/api";
export const AI_BACKEND_ENV_NAME = "VITE_AI_BACKEND_URL";
export const USE_DEV_API_PROXY_ENV_NAME = "VITE_USE_DEV_API_PROXY";

const DISABLED_FLAG_VALUES = new Set(["0", "false", "no", "off"]);

function hasOwn(source, key) {
  return Boolean(source) && Object.prototype.hasOwnProperty.call(source, key);
}

function normalizeEnvValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string") return value.trim();
  return "";
}

function readEnvValue(name, env = null) {
  if (env !== null) return hasOwn(env, name) ? normalizeEnvValue(env[name]) : "";
  if (hasOwn(ENV, name)) return normalizeEnvValue(ENV[name]);
  if (hasOwn(PROCESS_ENV, name)) return normalizeEnvValue(PROCESS_ENV[name]);
  return "";
}

function readBooleanEnv(name, env = null) {
  const value = readEnvValue(name, env);
  if (typeof value === "boolean") return value;
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

export function isViteDevelopmentEnv(env = null) {
  const devFlag = readBooleanEnv("DEV", env);
  if (typeof devFlag === "boolean") return devFlag;
  const prodFlag = readBooleanEnv("PROD", env);
  if (prodFlag === true) return false;
  const mode = String(readEnvValue("MODE", env) || "").trim().toLowerCase();
  return mode === "development";
}

export function isDevApiProxyEnabled(env = null) {
  if (!isViteDevelopmentEnv(env)) return false;
  const flag = String(readEnvValue(USE_DEV_API_PROXY_ENV_NAME, env) || "").trim().toLowerCase();
  return !DISABLED_FLAG_VALUES.has(flag);
}

export function normalizeApiBaseUrl(rawValue, { allowRelative = true } = {}) {
  const value = String(rawValue || "").trim();
  if (!value) return "";

  if (allowRelative && value.startsWith("/")) {
    const [path = ""] = value.split(/[?#]/);
    const normalizedPath = `/${path.replace(/^\/+/, "").replace(/\/+$/, "")}`;
    return normalizedPath === "/" ? "" : normalizedPath;
  }

  return normalizeBaseUrl(value);
}

export function getApiBaseUrl(rawValue, { env = null, inferLocal = true } = {}) {
  if (typeof rawValue === "string") {
    return normalizeApiBaseUrl(rawValue);
  }

  if (isDevApiProxyEnabled(env)) {
    return API_PROXY_PREFIX;
  }

  const explicitBackendUrl = readEnvValue(AI_BACKEND_ENV_NAME, env);
  if (explicitBackendUrl) {
    return normalizeApiBaseUrl(explicitBackendUrl, { allowRelative: false });
  }

  return inferLocal ? inferLocalAiBackendBaseUrl() : "";
}

export function readAiBackendBaseUrl(rawValue) {
  return getApiBaseUrl(rawValue);
}

export function isAiBackendConfigured(rawValue) {
  return Boolean(readAiBackendBaseUrl(rawValue));
}

export function buildApiUrl(path, rawBaseUrl, options = {}) {
  const baseUrl = getApiBaseUrl(rawBaseUrl, options);
  if (!baseUrl) return "";

  const endpoint = String(path || "").trim();
  if (!endpoint) return baseUrl;

  const normalizedEndpoint = endpoint.replace(/^\/+/, "");
  if (!normalizedEndpoint) return baseUrl;

  return `${baseUrl.replace(/\/+$/, "")}/${normalizedEndpoint}`;
}
