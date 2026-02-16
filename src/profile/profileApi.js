import { supabase } from "../infra/supabaseClient";
import { normalizeUsername, validateUsername } from "./username";

const LOCAL_PROFILE_PREFIX = "e2e.supabase.profile.user.";
export const LOCAL_PROFILE_USERNAME_MAP_KEY = "e2e.supabase.profile.usernames";

function safeParse(raw, fallback = null) {
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readLocalUsernameMap() {
  if (typeof window === "undefined") return {};
  const parsed = safeParse(window.localStorage.getItem(LOCAL_PROFILE_USERNAME_MAP_KEY), {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function writeLocalUsernameMap(map) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_PROFILE_USERNAME_MAP_KEY, JSON.stringify(map || {}));
}

export function buildLocalProfileKey(userId) {
  return `${LOCAL_PROFILE_PREFIX}${String(userId || "")}`;
}

function readLocalProfile(userId) {
  if (typeof window === "undefined") return null;
  const parsed = safeParse(window.localStorage.getItem(buildLocalProfileKey(userId)), null);
  return parsed && typeof parsed === "object" ? parsed : null;
}

function saveLocalProfile(profile) {
  if (typeof window === "undefined") return;
  const userId = String(profile?.user_id || "").trim();
  if (!userId) return;

  const key = buildLocalProfileKey(userId);
  const prev = readLocalProfile(userId);
  window.localStorage.setItem(key, JSON.stringify(profile));

  const map = readLocalUsernameMap();
  const nextUsername = normalizeUsername(profile?.username);
  const prevUsername = normalizeUsername(prev?.username);

  if (prevUsername && map[prevUsername] === userId && prevUsername !== nextUsername) {
    delete map[prevUsername];
  }
  if (nextUsername) {
    map[nextUsername] = userId;
  }
  writeLocalUsernameMap(map);
}

function toProfileRow(row) {
  if (!row || typeof row !== "object") return null;
  const userId = String(row.user_id || "").trim();
  if (!userId) return null;
  return {
    user_id: userId,
    username: normalizeUsername(row.username),
    display_name: String(row.display_name || "").trim(),
    birthdate: row.birthdate ? String(row.birthdate) : "",
    created_at: row.created_at ? String(row.created_at) : "",
    updated_at: row.updated_at ? String(row.updated_at) : "",
  };
}

function isUniqueViolation(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return code === "23505" || message.includes("duplicate key") || message.includes("already exists");
}

function isRlsViolation(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return code === "42501" || message.includes("row level security") || message.includes("permission denied");
}

function isNetworkFailure(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("failed to fetch") || message.includes("network");
}

function mapProfileError(error) {
  if (isUniqueViolation(error)) {
    const err = new Error("Nom d'utilisateur déjà pris.");
    err.code = "USERNAME_TAKEN";
    return err;
  }
  if (isRlsViolation(error)) {
    const err = new Error("Accès refusé (RLS). Reconnecte-toi puis réessaie.");
    err.code = "PROFILE_RLS";
    return err;
  }
  if (isNetworkFailure(error)) {
    const err = new Error("Réseau indisponible. Vérifie ta connexion puis réessaie.");
    err.code = "PROFILE_NETWORK";
    return err;
  }
  return error;
}

export async function loadProfile(userId, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;
  const preferLocal = Boolean(options?.preferLocal);
  const throwOnRemoteError = Boolean(options?.throwOnRemoteError);

  if (preferLocal || !supabase) {
    return readLocalProfile(normalizedUserId);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, username, display_name, birthdate, created_at, updated_at")
    .eq("user_id", normalizedUserId)
    .maybeSingle();

  if (error) {
    const local = readLocalProfile(normalizedUserId);
    if (local) return local;
    if (throwOnRemoteError) throw mapProfileError(error);
    return null;
  }

  const row = toProfileRow(data);
  if (row) saveLocalProfile(row);
  return row;
}

export async function isUsernameAvailable(username, options = {}) {
  const currentUserId = String(options?.currentUserId || "").trim();
  const preferLocal = Boolean(options?.preferLocal);
  const parsed = validateUsername(username);
  if (!parsed.ok) {
    return { available: false, normalized: parsed.normalized, reason: parsed.reason };
  }

  const normalized = parsed.normalized;

  if (preferLocal || !supabase) {
    const map = readLocalUsernameMap();
    const owner = String(map[normalized] || "").trim();
    const available = !owner || owner === currentUserId;
    return { available, normalized, reason: available ? "" : "Nom d'utilisateur déjà pris." };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id")
    .ilike("username", normalized)
    .limit(1);

  if (error) {
    const map = readLocalUsernameMap();
    const owner = String(map[normalized] || "").trim();
    const available = !owner || owner === currentUserId;
    return { available, normalized, reason: available ? "" : "Nom d'utilisateur déjà pris." };
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const owner = String(row?.user_id || "").trim();
  const available = !owner || owner === currentUserId;
  return { available, normalized, reason: available ? "" : "Nom d'utilisateur déjà pris." };
}

export async function createProfile(userId, input = {}, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("Utilisateur non authentifié.");
  const preferLocal = Boolean(options?.preferLocal);

  const parsed = validateUsername(input.username);
  if (!parsed.ok) throw new Error(parsed.reason);

  const normalized = parsed.normalized;
  const displayName = String(input.display_name || "").trim();
  const birthdate = input.birthdate ? String(input.birthdate) : "";

  const availability = await isUsernameAvailable(normalized, {
    currentUserId: normalizedUserId,
    preferLocal,
  });

  if (!availability.available) {
    const err = new Error("Nom d'utilisateur déjà pris.");
    err.code = "USERNAME_TAKEN";
    throw err;
  }

  const payload = {
    user_id: normalizedUserId,
    username: normalized,
    display_name: displayName,
    birthdate: birthdate || null,
  };

  if (preferLocal || !supabase) {
    const row = toProfileRow(payload);
    saveLocalProfile(row);
    return row;
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert(payload)
    .select("user_id, username, display_name, birthdate, created_at, updated_at")
    .single();

  if (error) {
    throw mapProfileError(error);
  }

  const row = toProfileRow(data || payload);
  saveLocalProfile(row);
  return row;
}
