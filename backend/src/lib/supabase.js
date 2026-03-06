import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient(config) {
  return createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function verifySupabaseAccessToken(supabase, accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  if (error) return null;
  return data?.user || null;
}

export async function loadUserSnapshot(supabase, userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      profile: null,
      userData: {},
      entitlement: null,
    };
  }

  const [profileResult, userDataResult, entitlementResult] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", normalizedUserId).maybeSingle(),
    supabase.from("user_data").select("data").eq("user_id", normalizedUserId).maybeSingle(),
    supabase
      .from("billing_entitlements")
      .select("*")
      .eq("user_id", normalizedUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (userDataResult.error) throw userDataResult.error;
  if (entitlementResult.error) throw entitlementResult.error;

  return {
    profile: profileResult.data || null,
    userData:
      userDataResult.data?.data && typeof userDataResult.data.data === "object"
        ? userDataResult.data.data
        : {},
    entitlement: entitlementResult.data || null,
  };
}
