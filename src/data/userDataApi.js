import { supabase } from "../infra/supabaseClient";

const LOCAL_USER_DATA_PREFIX = "e2e.supabase.user_data.";

function safeParse(raw) {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function buildLocalUserDataKey(userId) {
  return `${LOCAL_USER_DATA_PREFIX}${String(userId || "")}`;
}

export const isRemoteUserDataEnabled = Boolean(supabase);

function loadLocalUserData(userId) {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(buildLocalUserDataKey(userId)));
}

function saveLocalUserData(userId, data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(buildLocalUserDataKey(userId), JSON.stringify(data || {}));
}

export async function loadUserData(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return {};

  if (!supabase) {
    return loadLocalUserData(normalizedUserId);
  }

  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    return loadLocalUserData(normalizedUserId);
  }
  const payload = data?.data;
  const safePayload = payload && typeof payload === "object" ? payload : {};
  saveLocalUserData(normalizedUserId, safePayload);
  return safePayload;
}

export async function upsertUserData(userId, data) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("userId requis");
  const payload = data && typeof data === "object" ? data : {};

  if (!supabase) {
    saveLocalUserData(normalizedUserId, payload);
    return payload;
  }

  const { error } = await supabase
    .from("user_data")
    .upsert(
      {
        user_id: normalizedUserId,
        data: payload,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  saveLocalUserData(normalizedUserId, payload);
  if (error) throw error;
  return payload;
}
