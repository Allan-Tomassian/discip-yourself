import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import { LOCAL_USER_DATA_PREFIX } from "../data/userDataApi";
import {
  LOCAL_PROFILE_PREFIX,
  LOCAL_PROFILE_USERNAME_MAP_KEY,
} from "../profile/profileApi";
import { CLICK_SOUND_STORAGE_KEY } from "../shared/ui/sound/useClickSound";
import { LS_KEY } from "../utils/storage";
import { readFrontendAppEnv } from "../infra/frontendEnv";

export const LOCAL_DATA_RESET_COPY = Object.freeze({
  sectionTitle: "Zone test",
  sectionSubtitle: "Outils visibles uniquement en environnement local, staging ou développement.",
  notice: "Cette action efface les données stockées sur cet appareil. Elle ne supprime pas ton compte.",
  resetLabel: "Réinitialiser les données locales",
  logoutResetLabel: "Déconnexion + reset local",
  confirmTitle: "Confirmer le reset local",
  confirmResetCta: "Réinitialiser",
  confirmLogoutResetCta: "Déconnecter et réinitialiser",
  cancel: "Annuler",
});

const LOCAL_RESET_APP_ENVS = new Set(["local", "dev", "development", "staging", "stage", "test"]);
const PRODUCTION_APP_ENVS = new Set(["prod", "production"]);
const LOCAL_STORAGE_KEY_PREFIXES = Object.freeze([
  `${LS_KEY}__`,
  LOCAL_USER_DATA_PREFIX,
  LOCAL_PROFILE_PREFIX,
  "dailyNote:",
  "dailyNoteMeta:",
  "dailyNoteHistory:",
]);
const LOCAL_STORAGE_KEY_EXACT = Object.freeze([
  LS_KEY,
  LOCAL_PROFILE_USERNAME_MAP_KEY,
  CLICK_SOUND_STORAGE_KEY,
  "dailyNoteHistory",
]);
const SESSION_STORAGE_KEY_PREFIXES = Object.freeze(["__discip_e2e_"]);
const SESSION_STORAGE_KEY_EXACT = Object.freeze(["discip.auth.recovery_mode"]);

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEnvValue(value) {
  return safeString(value).toLowerCase();
}

function getRuntimeHostname() {
  if (typeof window === "undefined") return "";
  return safeString(window.location?.hostname).toLowerCase();
}

function isPrivateIpv4Hostname(hostname) {
  const parts = safeString(hostname).split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number.parseInt(part, 10));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31);
}

function isLocalHostname(hostname) {
  const value = normalizeEnvValue(hostname);
  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "[::1]" ||
    value.endsWith(".local") ||
    isPrivateIpv4Hostname(value)
  );
}

function readDefaultResetEnvironment() {
  const env =
    typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
      ? import.meta.env
      : {};
  return {
    appEnv: readFrontendAppEnv(),
    mode: env.MODE,
    dev: env.DEV,
    prod: env.PROD,
    hostname: getRuntimeHostname(),
  };
}

export function isLocalDataResetEnvironment(environment = readDefaultResetEnvironment()) {
  const appEnv = normalizeEnvValue(environment?.appEnv) || "local";
  const mode = normalizeEnvValue(environment?.mode);
  const hostname = normalizeEnvValue(environment?.hostname);

  if (PRODUCTION_APP_ENVS.has(appEnv)) return false;
  if (environment?.prod === true && mode === "production" && appEnv === "local") return false;
  if (LOCAL_RESET_APP_ENVS.has(appEnv)) return true;
  if (environment?.dev === true) return true;
  if (mode === "staging" || mode === "development" || mode === "dev" || mode === "test") return true;
  if (environment?.prod === true && mode === "production") return false;
  return isLocalHostname(hostname);
}

function listStorageKeys(storage) {
  if (!storage) return [];
  if (Number.isInteger(storage.length) && typeof storage.key === "function") {
    const keys = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (typeof key === "string") keys.push(key);
    }
    return keys;
  }
  return Object.keys(storage).filter((key) => typeof storage.getItem !== "function" || storage.getItem(key) !== null);
}

function matchesAnyPrefix(key, prefixes) {
  return prefixes.some((prefix) => safeString(prefix) && key.startsWith(prefix));
}

function shouldRemoveLocalStorageKey(key, { includeAuth = false } = {}) {
  const safeKey = safeString(key);
  if (!safeKey) return false;
  if (LOCAL_STORAGE_KEY_EXACT.includes(safeKey)) return true;
  if (matchesAnyPrefix(safeKey, LOCAL_STORAGE_KEY_PREFIXES)) return true;
  if (includeAuth && safeKey === E2E_AUTH_SESSION_KEY) return true;
  if (includeAuth && safeKey.startsWith("sb-") && safeKey.includes("auth-token")) return true;
  return false;
}

function shouldRemoveSessionStorageKey(key) {
  const safeKey = safeString(key);
  if (!safeKey) return false;
  if (SESSION_STORAGE_KEY_EXACT.includes(safeKey)) return true;
  return matchesAnyPrefix(safeKey, SESSION_STORAGE_KEY_PREFIXES);
}

function removeStorageKeys(storage, predicate) {
  const removedKeys = [];
  for (const key of listStorageKeys(storage)) {
    if (!predicate(key)) continue;
    try {
      storage.removeItem(key);
      removedKeys.push(key);
    } catch {
      // Best-effort local cleanup only.
    }
  }
  return removedKeys;
}

export function clearLocalAppStorage({
  localStorageRef = typeof window !== "undefined" ? window.localStorage : null,
  sessionStorageRef = typeof window !== "undefined" ? window.sessionStorage : null,
  includeAuth = false,
} = {}) {
  const localStorageKeys = removeStorageKeys(
    localStorageRef,
    (key) => shouldRemoveLocalStorageKey(key, { includeAuth })
  );
  const sessionStorageKeys = removeStorageKeys(sessionStorageRef, shouldRemoveSessionStorageKey);
  return {
    localStorageKeys,
    sessionStorageKeys,
  };
}

function reloadAfterReset({ includeLogout = false } = {}) {
  if (typeof window === "undefined") return;
  if (includeLogout) {
    window.location.assign("/auth/welcome");
    return;
  }
  window.location.reload();
}

export async function runLocalDataReset({
  includeLogout = false,
  signOut,
  localStorageRef,
  sessionStorageRef,
  reload = reloadAfterReset,
} = {}) {
  let signOutError = null;
  if (includeLogout && typeof signOut === "function") {
    try {
      await signOut();
    } catch (error) {
      signOutError = error;
    }
  }

  const cleared = clearLocalAppStorage({
    localStorageRef,
    sessionStorageRef,
    includeAuth: includeLogout,
  });

  if (typeof reload === "function") {
    reload({ includeLogout });
  }

  return {
    ok: !signOutError,
    signOutError,
    ...cleared,
  };
}
