function normalizeStatus(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null;
}

function normalizeMessage(value) {
  const message = String(value || "").trim();
  return message;
}

export function maskSecret(value) {
  const raw = String(value || "");
  if (!raw) return "";
  if (raw.length <= 8) return `${raw.slice(0, 2)}***`;
  return `${raw.slice(0, 4)}...${raw.slice(-4)}`;
}

export function formatSupabaseAuthError(error) {
  const statusCode = normalizeStatus(error?.status || error?.statusCode || error?.code);
  const sourceMessage = normalizeMessage(error?.message) || "Échec réseau (Failed to fetch).";

  if (statusCode) {
    return {
      statusCode,
      sourceMessage,
      userMessage: `Impossible d'envoyer l'email (status ${statusCode}) : ${sourceMessage}`,
    };
  }

  return {
    statusCode: null,
    sourceMessage,
    userMessage: `Impossible d'envoyer l'email : ${sourceMessage}`,
  };
}
