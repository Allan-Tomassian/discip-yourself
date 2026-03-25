import { supabase } from "../infra/supabaseClient";
import { E2E_AUTH_SESSION_KEY } from "../auth/constants";
import { canUseLocalPersistenceFallback, mapUserDataPersistenceError } from "../infra/supabasePersistenceErrors";

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

function hasObjectKeys(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
}

function isUsingE2EMockedSession(userId) {
  if (!userId || typeof window === "undefined") return false;
  if (!import.meta.env.DEV) return false;
  try {
    const raw = window.localStorage.getItem(E2E_AUTH_SESSION_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed?.user?.id === userId;
  } catch {
    return false;
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

  if (isUsingE2EMockedSession(normalizedUserId)) {
    return loadLocalUserData(normalizedUserId);
  }

  if (!supabase) {
    return loadLocalUserData(normalizedUserId);
  }

  const { data, error } = await supabase
    .from("user_data")
    .select("data")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    const mappedError = mapUserDataPersistenceError(error);
    if (canUseLocalPersistenceFallback(mappedError)) {
      return loadLocalUserData(normalizedUserId);
    }
    throw mappedError;
  }
  const payload = data?.data;
  const safePayload = payload && typeof payload === "object" ? payload : {};
  if (!hasObjectKeys(safePayload)) {
    const localFallback = loadLocalUserData(normalizedUserId);
    if (hasObjectKeys(localFallback)) {
      return localFallback;
    }
  }
  saveLocalUserData(normalizedUserId, safePayload);
  return safePayload;
}

export async function upsertUserData(userId, data) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("userId requis");
  const payload = data && typeof data === "object" ? data : {};

  if (isUsingE2EMockedSession(normalizedUserId)) {
    saveLocalUserData(normalizedUserId, payload);
    return payload;
  }

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

  if (error) {
    const mappedError = mapUserDataPersistenceError(error);
    if (canUseLocalPersistenceFallback(mappedError)) {
      saveLocalUserData(normalizedUserId, payload);
    }
    throw mappedError;
  }
  saveLocalUserData(normalizedUserId, payload);
  return payload;
}
