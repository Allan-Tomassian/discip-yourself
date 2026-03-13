function normalizedMessage(error) {
  return String(error?.message || "").trim().toLowerCase();
}

function normalizedCode(error) {
  return String(error?.code || "").trim().toUpperCase();
}

export function isSupabaseNetworkError(error) {
  const code = normalizedCode(error);
  const message = normalizedMessage(error);
  return (
    code === "PROFILE_NETWORK" ||
    code === "USER_DATA_NETWORK" ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("réseau") ||
    message.includes("fetch failed") ||
    message.includes("load failed")
  );
}

export function isSupabaseRlsError(error) {
  const code = normalizedCode(error);
  const message = normalizedMessage(error);
  return code === "42501" || message.includes("row level security") || message.includes("permission denied");
}

export function isSupabaseSchemaError(error) {
  const code = normalizedCode(error);
  const message = normalizedMessage(error);
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    message.includes("schema cache") ||
    message.includes("could not find the table") ||
    message.includes("does not exist") ||
    message.includes("relation") && message.includes("does not exist")
  );
}

export function canUseLocalPersistenceFallback(error) {
  return isSupabaseNetworkError(error);
}

export function mapProfilePersistenceError(error) {
  if (isSupabaseSchemaError(error)) {
    const err = new Error("Base Supabase incomplète pour le profil. Applique les migrations requises.");
    err.code = "PROFILE_SCHEMA";
    return err;
  }
  if (isSupabaseRlsError(error)) {
    const err = new Error("Accès refusé (RLS). Reconnecte-toi puis réessaie.");
    err.code = "PROFILE_RLS";
    return err;
  }
  if (isSupabaseNetworkError(error)) {
    const err = new Error("Réseau indisponible. Vérifie ta connexion puis réessaie.");
    err.code = "PROFILE_NETWORK";
    return err;
  }
  return error;
}

export function mapUserDataPersistenceError(error) {
  if (isSupabaseSchemaError(error)) {
    const err = new Error("Base Supabase incomplète pour user_data. Applique les migrations requises.");
    err.code = "USER_DATA_SCHEMA";
    return err;
  }
  if (isSupabaseRlsError(error)) {
    const err = new Error("Accès refusé sur user_data. Reconnecte-toi puis réessaie.");
    err.code = "USER_DATA_RLS";
    return err;
  }
  if (isSupabaseNetworkError(error)) {
    const err = new Error("Réseau indisponible pendant la synchronisation user_data.");
    err.code = "USER_DATA_NETWORK";
    return err;
  }
  return error;
}
