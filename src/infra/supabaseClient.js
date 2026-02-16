import { createClient } from "@supabase/supabase-js";

/**
 * Vite exposes env vars on import.meta.env.
 * This module is defensive so the app doesn’t hard-crash when env is missing.
 */
const ENV =
  typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
    ? import.meta.env
    : {};

// Accept multiple possible key names to avoid 401 "No API key found" when .env uses a different naming.
export const SUPABASE_URL = (ENV.VITE_SUPABASE_URL || "").trim();
export const SUPABASE_ANON_KEY = (
  ENV.VITE_SUPABASE_ANON_KEY ||
  ENV.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ENV.VITE_SUPABASE_PUBLIC_ANON_KEY ||
  ""
).trim();

const isDev = Boolean(ENV.DEV);
const isTest = Boolean(ENV.MODE === "test" || ENV.VITEST);

// Allow the standard Supabase project URL. Keep permissive enough for future domain variants.
const SUPABASE_URL_RE = /^https:\/\/[a-z0-9-]+\.supabase\.(co|com)$/i;

export const SUPABASE_ENV_ERROR_MESSAGE =
  "Supabase env invalid: configure .env with Project URL + anon (publishable) key";

export function validateSupabaseUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  const hasPlaceholder = value.toLowerCase().includes("your-project-ref") || value.toLowerCase().includes("your-project");
  if (!value || hasPlaceholder || !SUPABASE_URL_RE.test(value)) {
    const error = new Error(SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_URL_INVALID";
    throw error;
  }
  return value;
}

export function validateSupabaseAnonKey(rawKey) {
  const value = String(rawKey || "").trim();
  const looksPlaceholder = value.toLowerCase().startsWith("your-") || value.toLowerCase().includes("insert") || value.toLowerCase().includes("replace");
  if (!value || looksPlaceholder) {
    const error = new Error(SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_ANON_KEY_INVALID";
    throw error;
  }
  return value;
}

export function validateSupabaseEnv(rawUrl, rawAnonKey) {
  const url = validateSupabaseUrl(rawUrl);
  const anonKey = validateSupabaseAnonKey(rawAnonKey);
  return { url, anonKey };
}

let validatedEnv = { url: "", anonKey: "" };
let supabaseEnvError = "";
try {
  validatedEnv = validateSupabaseEnv(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
  supabaseEnvError = error?.message || SUPABASE_ENV_ERROR_MESSAGE;
}

export const hasSupabaseConfig = Boolean(!supabaseEnvError && validatedEnv.url && validatedEnv.anonKey);
export const supabaseConfigError = supabaseEnvError;

if (isDev && !isTest) {
  // Debug logs for local setup diagnostics (never log keys).
  // eslint-disable-next-line no-console
  console.info(`[supabase] runtime URL: ${SUPABASE_URL || "(empty)"}`);
  // eslint-disable-next-line no-console
  console.info(`[supabase] anon key present: ${Boolean(SUPABASE_ANON_KEY)}`);
  if (supabaseConfigError) {
    // eslint-disable-next-line no-console
    console.error(`[supabase] ${supabaseConfigError}`);
  }
}

/**
 * Exported client instance.
 * If env is missing/invalid, supabase will be null (caller should handle gracefully).
 */
export const supabase = hasSupabaseConfig
  ? createClient(validatedEnv.url, validatedEnv.anonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Convenience helper when you want a hard failure instead of null.
 */
export function getSupabaseOrThrow() {
  if (!supabase) {
    const error = new Error(supabaseConfigError || SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_NOT_CONFIGURED";
    throw error;
  }
  return supabase;
}
