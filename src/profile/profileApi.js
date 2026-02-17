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

function toProfileRow(row) {
  if (!row || typeof row !== "object") return null;
  const userId = getProfileId(row);
  if (!userId) return null;

  return {
    id: userId,
    email: row.email ? String(row.email).trim() : "",
    username: normalizeUsername(row.username),
    full_name: String(row.full_name || "").trim(),
    avatar_url: String(row.avatar_url || "").trim(),
    created_at: row.created_at ? String(row.created_at) : "",
    updated_at: row.updated_at ? String(row.updated_at) : "",
  };
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
  const next = toProfileRow(profile);
  if (!next) return;

  window.localStorage.setItem(key, JSON.stringify(next));

  const map = readLocalUsernameMap();
  const nextUsername = normalizeUsername(next.username);
  const prevUsername = normalizeUsername(prev?.username);

  if (prevUsername && map[prevUsername] === userId && prevUsername !== nextUsername) {
    delete map[prevUsername];
  }
  if (nextUsername) {
    map[nextUsername] = userId;
  }
  writeLocalUsernameMap(map);
}

export function isProfileComplete(profile) {
  if (!profile || typeof profile !== "object") return false;
  return Boolean(String(profile.username || "").trim());
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

function normalizeProfilePayload(userId, data = {}) {
  const payload = { id: String(userId || "").trim() };

  if (Object.prototype.hasOwnProperty.call(data, "email")) {
    const email = String(data.email || "").trim();
    payload.email = email || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, "username")) {
    const parsed = validateUsername(data.username);
    if (!parsed.ok) throw new Error(parsed.reason);
    payload.username = parsed.normalized;
  }

  if (Object.prototype.hasOwnProperty.call(data, "full_name")) {
    const fullName = String(data.full_name || "").trim();
    payload.full_name = fullName || null;
  }

  if (Object.prototype.hasOwnProperty.call(data, "avatar_url")) {
    const avatarUrl = String(data.avatar_url || "").trim();
    payload.avatar_url = avatarUrl || null;
  }

  return payload;
}

export async function upsertProfile(userId, data = {}, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("Utilisateur non authentifié.");

  const preferLocal = Boolean(options?.preferLocal);
  const payload = normalizeProfilePayload(normalizedUserId, data);

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
    .select("*")
    .single();

  if (error) throw mapProfileError(error);

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
    .select("*")
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
    .select("id, username")
    .ilike("username", normalized)
    .limit(3);

  if (error) {
    const map = readLocalUsernameMap();
    const owner = String(map[normalized] || "").trim();
    const available = !owner || owner === currentUserId;
    return { available, normalized, reason: available ? "" : "Nom d'utilisateur déjà pris." };
  }

  const rows = Array.isArray(data) ? data : [];
  const ownerRow = rows.find((row) => normalizeUsername(row?.username) === normalized) || null;
  const owner = String(ownerRow?.id || "").trim();
  const available = !owner || owner === currentUserId;

  return { available, normalized, reason: available ? "" : "Nom d'utilisateur déjà pris." };
}

export async function createProfile(userId, input = {}, options = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("Utilisateur non authentifié.");

  const parsed = validateUsername(input.username);
  if (!parsed.ok) throw new Error(parsed.reason);

  const availability = await isUsernameAvailable(parsed.normalized, {
    currentUserId: normalizedUserId,
    preferLocal: Boolean(options?.preferLocal),
  });

  if (!availability.available) {
    const err = new Error("Nom d'utilisateur déjà pris.");
    err.code = "USERNAME_TAKEN";
    throw err;
  }

  return upsertProfile(
    normalizedUserId,
    {
      email: input.email,
      username: parsed.normalized,
      full_name: input.full_name,
      avatar_url: input.avatar_url,
    },
    options
  );
}
