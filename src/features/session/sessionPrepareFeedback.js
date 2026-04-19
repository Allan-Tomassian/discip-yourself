import {
  PREPARED_SESSION_REJECTION_REASONS,
  createEmptyPreparedSessionQuality,
} from "./sessionRunbook";

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeErrorCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeFailureQuality(quality = null) {
  return isPlainObject(quality)
    ? createEmptyPreparedSessionQuality(quality)
    : createEmptyPreparedSessionQuality();
}

function readFailureDetails(result = null) {
  return isPlainObject(result?.errorDetails) ? result.errorDetails : null;
}

export function readSessionPrepareFailureReason({ result = null, quality = null } = {}) {
  const normalizedQuality = normalizeFailureQuality(quality);
  const details = readFailureDetails(result);
  return (
    normalizedQuality.rejectionReason ||
    String(details?.rejectionReason || "").trim() ||
    normalizedQuality.reason ||
    null
  );
}

export function resolveSessionPrepareFailureMessage({ result = null, quality = null } = {}) {
  const errorCode = normalizeErrorCode(result?.errorCode || result?.backendErrorCode);
  const normalizedQuality = normalizeFailureQuality(quality);
  const rejectionReason = readSessionPrepareFailureReason({ result, quality: normalizedQuality });

  if (errorCode === "PREMIUM_REQUIRED") {
    return "Cette préparation détaillée fait partie du premium.";
  }
  if (errorCode === "AUTH_MISSING" || errorCode === "AUTH_INVALID") {
    return "Ta session a expiré. Recharge l'application puis réessaie.";
  }
  if (errorCode === "TIMEOUT" || errorCode === "SESSION_GUIDANCE_PROVIDER_TIMEOUT") {
    return "La préparation détaillée a expiré. Réessaye ou passe en standard.";
  }
  if (errorCode === "NETWORK_ERROR") {
    return "La préparation détaillée a échoué à cause du réseau. Réessaye ou passe en standard.";
  }
  if (errorCode === "BACKEND_UNAVAILABLE" || errorCode === "SESSION_GUIDANCE_BACKEND_UNAVAILABLE") {
    return "La préparation détaillée est indisponible pour le moment. Réessaye ou passe en standard.";
  }
  if (
    errorCode === "INVALID_RESPONSE" ||
    rejectionReason === PREPARED_SESSION_REJECTION_REASONS.PROVIDER_PARSE_FAILED ||
    rejectionReason === PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED ||
    rejectionReason === PREPARED_SESSION_REJECTION_REASONS.VALIDATION_FAILED ||
    normalizedQuality.validationPassed === false
  ) {
    return "Le plan premium reçu était inexploitable. Réessaye ou passe en standard.";
  }
  if (
    rejectionReason === PREPARED_SESSION_REJECTION_REASONS.RICHNESS_FAILED ||
    normalizedQuality.richnessPassed === false
  ) {
    return "Le plan détaillé n’était pas assez spécifique. Réessaye ou passe en standard.";
  }
  if (errorCode === "BACKEND_ERROR") {
    return "La préparation détaillée a échoué côté serveur. Réessaye ou passe en standard.";
  }
  if (errorCode === "RATE_LIMITED" || errorCode === "QUOTA_EXCEEDED") {
    return "La préparation détaillée est temporairement indisponible. Réessaye ou passe en standard.";
  }
  return "Impossible de préparer un plan détaillé pour le moment. Réessaye ou passe en standard.";
}

export function buildSessionPrepareFailureState({ result = null, quality = null } = {}) {
  const normalizedQuality = normalizeFailureQuality(quality);
  const details = readFailureDetails(result);

  return {
    errorCode: String(result?.errorCode || "").trim().toUpperCase() || null,
    backendErrorCode: String(result?.backendErrorCode || "").trim().toUpperCase() || null,
    status: Number.isFinite(result?.status) ? Math.round(result.status) : null,
    requestId: String(result?.requestId || "").trim() || null,
    rejectionReason: readSessionPrepareFailureReason({ result, quality: normalizedQuality }),
    rejectionStage: normalizedQuality.rejectionStage || String(details?.rejectionStage || "").trim() || null,
    validationPassed:
      typeof normalizedQuality.validationPassed === "boolean" ? normalizedQuality.validationPassed : null,
    richnessPassed:
      typeof normalizedQuality.richnessPassed === "boolean" ? normalizedQuality.richnessPassed : null,
    message: resolveSessionPrepareFailureMessage({ result, quality: normalizedQuality }),
  };
}
