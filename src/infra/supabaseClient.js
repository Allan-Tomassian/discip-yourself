import { createClient } from "@supabase/supabase-js";
import { shouldDetectSupabaseSessionInUrl } from "../auth/authPaths";
import {
  getSupabaseProjectRef,
  readFrontendRuntimeEnv,
  validateSupabaseEnv,
} from "./frontendEnv";

export {
  SUPABASE_ENV_ERROR_MESSAGE,
  getSupabaseProjectRef,
  validateSupabaseAnonKey,
  validateSupabaseEnv,
  validateSupabasePublishableKey,
  validateSupabaseUrl,
} from "./frontendEnv";

const runtimeEnv = readFrontendRuntimeEnv();
const validatedEnv = runtimeEnv.supabaseConfigError
  ? null
  : validateSupabaseEnv(runtimeEnv.supabaseUrl, runtimeEnv.supabasePublishableKey);

export const SUPABASE_URL = runtimeEnv.supabaseUrl;
export const SUPABASE_PUBLISHABLE_KEY = runtimeEnv.supabasePublishableKey;
export const SUPABASE_ANON_KEY = runtimeEnv.supabaseAnonKey;
export const supabaseConfigError = runtimeEnv.supabaseConfigError;
export const supabaseProjectRef = validatedEnv ? getSupabaseProjectRef(validatedEnv.url) : "";

export function isSupabaseReady() {
  return !supabaseConfigError;
}

export const supabase = validatedEnv
  ? createClient(validatedEnv.url, validatedEnv.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: shouldDetectSupabaseSessionInUrl,
    },
  })
  : null;
