const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._-]{1,28}[a-z0-9])?$/;

export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function validateUsername(value) {
  const normalized = normalizeUsername(value);

  if (!normalized) {
    return { ok: false, normalized, reason: "Le nom d'utilisateur est requis." };
  }

  if (normalized.length < 3 || normalized.length > 30) {
    return { ok: false, normalized, reason: "Le nom d'utilisateur doit contenir 3 à 30 caractères." };
  }

  if (!USERNAME_RE.test(normalized)) {
    return {
      ok: false,
      normalized,
      reason: "Utilise uniquement lettres, chiffres, ., _ ou - (sans espace).",
    };
  }

  return { ok: true, normalized, reason: "" };
}
