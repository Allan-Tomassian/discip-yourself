import { createClient } from "@supabase/supabase-js";
import { shouldDetectSupabaseSessionInUrl } from "../auth/authPaths";

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

export const SUPABASE_URL = String(
  ENV.VITE_SUPABASE_URL || PROCESS_ENV.VITE_SUPABASE_URL || PROCESS_ENV.E2E_SUPABASE_URL || ""
).trim();
export const SUPABASE_ANON_KEY = String(
  ENV.VITE_SUPABASE_ANON_KEY || PROCESS_ENV.VITE_SUPABASE_ANON_KEY || PROCESS_ENV.E2E_SUPABASE_ANON_KEY || ""
).trim();

const SUPABASE_URL_RE = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i;
const SUPABASE_PUBLISHABLE_KEY_RE = /^sb_publishable_[a-z0-9._-]+$/i;
export const SUPABASE_ENV_ERROR_MESSAGE =
  "Supabase env invalid: configure .env with Project URL + anon/publishable key";

export function validateSupabaseUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  const lower = value.toLowerCase();
  const hasPlaceholder = lower.includes("your-project-ref") || lower.includes("your-project");
  if (!value || hasPlaceholder || !SUPABASE_URL_RE.test(value)) {
    const error = new Error(SUPABASE_ENV_ERROR_MESSAGE);
    error.code = "SUPABASE_URL_INVALID";
    throw error;
  }
  return value;
}

export function validateSupabaseAnonKey(rawKey) {
  const value = String(rawKey || "").trim();
  const lower = value.toLowerCase();
  const isPlaceholder = lower.startsWith("your-") || lower.includes("replace") || lower.includes("insert");
  const isPublishable = SUPABASE_PUBLISHABLE_KEY_RE.test(value);
  const isJwt = value.startsWith("eyJ");

  if (!value || isPlaceholder || (!isPublishable && !isJwt)) {
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

let validatedEnv = null;
let supabaseConfigError = "";
try {
  validatedEnv = validateSupabaseEnv(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
  supabaseConfigError = error?.message || SUPABASE_ENV_ERROR_MESSAGE;
}

export { supabaseConfigError };

if (supabaseConfigError) {
  throw new Error(supabaseConfigError);
}

export const supabaseProjectRef = getSupabaseProjectRef(validatedEnv.url);

export function isSupabaseReady() {
  return true;
}

export const supabase = createClient(validatedEnv.url, validatedEnv.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: shouldDetectSupabaseSessionInUrl,
  },
});
