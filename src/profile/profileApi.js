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

function getProfileId(value) {
  return String(value?.id || "").trim();
}

function readLocalProfile(userId) {
  if (typeof window === "undefined") return null;
  const parsed = safeParse(window.localStorage.getItem(buildLocalProfileKey(userId)), null);
  return toProfileRow(parsed);
}

function saveLocalProfile(profile) {
  if (typeof window === "undefined") return;
  const userId = getProfileId(profile);
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
  const userId = getProfileId(row);
  if (!userId) return null;
  return {
    id: userId,
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

function isBootstrapSchemaError(error) {
  const code = String(error?.code || "").trim();
  const message = String(error?.message || "").toLowerCase();
  return code === "42703" || code === "23502" || message.includes("column") || message.includes("not-null");
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

function mapEnsureProfileError(error) {
  if (isBootstrapSchemaError(error)) {
    const err = new Error(
      "Profil absent. Création automatique impossible (schéma profiles incompatible avec { id, email })."
    );
    err.code = "PROFILE_BOOTSTRAP_FAILED";
    return err;
  }
  return mapProfileError(error);
}

export async function upsertProfile(userId, data = {}, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("Utilisateur non authentifié.");
  const preferLocal = Boolean(options?.preferLocal);

  const payload = { id: normalizedUserId };
  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    payload.email = data.email ? String(data.email).trim() : null;
  }
  if (Object.prototype.hasOwnProperty.call(data, "username")) {
    const parsed = validateUsername(data.username);
    if (!parsed.ok) throw new Error(parsed.reason);
    payload.username = parsed.normalized;
  }
  if (Object.prototype.hasOwnProperty.call(data, "display_name")) {
    payload.display_name = String(data.display_name || "").trim();
  }
  if (Object.prototype.hasOwnProperty.call(data, "birthdate")) {
    payload.birthdate = data.birthdate ? String(data.birthdate) : null;
  }

  if (preferLocal || !supabase) {
    const localExisting = readLocalProfile(normalizedUserId);
    const localPayload = { ...(localExisting || { id: normalizedUserId }), ...payload };
    const row = toProfileRow(localPayload);
    saveLocalProfile(row);
    return row;
  }

  const { data: next, error } = await supabase
    .from("profiles")
    .upsert(payload, { onConflict: "id" })
    .select("id, username, display_name, birthdate, created_at, updated_at")
    .single();

  if (error) throw mapEnsureProfileError(error);

  const row = toProfileRow(next || payload);
  saveLocalProfile(row);
  return row;
}

export async function ensureProfile(userId, email = "", options = {}) {
  return upsertProfile(userId, { email }, options);
}

export async function getProfile(userId, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return null;
  const preferLocal = Boolean(options?.preferLocal);
  const throwOnRemoteError = Boolean(options?.throwOnRemoteError);
  const ensureOnMissing = Boolean(options?.ensureOnMissing);
  const email = String(options?.email || "").trim();

  if (preferLocal || !supabase) {
    return readLocalProfile(normalizedUserId);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, birthdate, created_at, updated_at")
    .eq("id", normalizedUserId)
    .maybeSingle();

  if (error) {
    const local = readLocalProfile(normalizedUserId);
    if (local) return local;
    if (throwOnRemoteError) throw mapProfileError(error);
    return null;
  }

  const row = toProfileRow(data);
  if (!row && ensureOnMissing) {
    return ensureProfile(normalizedUserId, email, options);
  }
  if (row) saveLocalProfile(row);
  return row;
}

export async function loadProfile(userId, options = {}) {
  return getProfile(userId, options);
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
    .select("id")
    .ilike("username", normalized)
    .limit(1);

  if (error) {
    const map = readLocalUsernameMap();
    const owner = String(map[normalized] || "").trim();
    const available = !owner || owner === currentUserId;
    return { available, normalized, reason: available ? "" : "Nom d'utilisateur déjà pris." };
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  const owner = String(row?.id || "").trim();
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
    id: normalizedUserId,
    username: normalized,
    display_name: displayName,
    birthdate: birthdate || null,
  };

  return upsertProfile(normalizedUserId, payload, { ...options, preferLocal });
}
