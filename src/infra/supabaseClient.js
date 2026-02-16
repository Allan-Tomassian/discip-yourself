import { createClient } from "@supabase/supabase-js";

const ENV =
  typeof import.meta !== "undefined" && import.meta.env && typeof import.meta.env === "object"
    ? import.meta.env
    : {};

export const SUPABASE_URL = ENV.VITE_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY || "";

export const hasSupabaseConfig = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const isDev = Boolean(ENV.DEV);

if (isDev && !hasSupabaseConfig) {
  const missing = [];
  if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL");
  if (!SUPABASE_ANON_KEY) missing.push("VITE_SUPABASE_ANON_KEY");
  // Temp debug log for local setup.
  // eslint-disable-next-line no-console
  console.warn(`[supabase] config manquante: ${missing.join(", ")}`);
}

export const supabase = hasSupabaseConfig
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
