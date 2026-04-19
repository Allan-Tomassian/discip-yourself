function nowIso() {
  return new Date().toISOString();
}

export function shouldReuseFirstRunGeneratedPlans({ generatedPlans, inputHash }) {
  return Boolean(generatedPlans?.inputHash && generatedPlans.inputHash === inputHash);
}

export function shouldStartFirstRunGeneration({ firstRun, inputHash, inFlightInputHash = null }) {
  if (firstRun?.status !== "generate") return false;
  if (firstRun?.generationError && firstRun?.inputHash === inputHash) return false;
  if (inFlightInputHash === inputHash) return false;
  return true;
}

export function markFirstRunGenerationPending(current, inputHash, timestamp = nowIso()) {
  if (current?.status !== "generate") return current;
  return {
    ...current,
    inputHash,
    generationError: null,
    selectedPlanId: null,
    lastUpdatedAt: timestamp,
  };
}

export function reuseFirstRunGeneratedPlans(current, inputHash, timestamp = nowIso()) {
  if (current?.status !== "generate") return current;
  return {
    ...current,
    inputHash,
    generationError: null,
    status: "compare",
    lastUpdatedAt: timestamp,
  };
}

export function buildFirstRunGenerationError(result) {
  return {
    code: result?.errorCode || "BACKEND_ERROR",
    message: result?.errorMessage || "Impossible de générer les plans pour le moment.",
    requestId: result?.requestId || null,
    backendErrorCode: result?.backendErrorCode || null,
    probableCause: result?.transportMeta?.probableCause || null,
    baseUrlUsed: result?.baseUrlUsed || result?.transportMeta?.backendBaseUrl || null,
    originUsed: result?.originUsed || result?.transportMeta?.frontendOrigin || null,
    details: result?.errorDetails || null,
  };
}

export function applyFirstRunGenerationFailure(current, { inputHash, error, timestamp = nowIso() }) {
  if (current?.status !== "generate") return current;
  if (current?.inputHash !== inputHash) return current;
  return {
    ...current,
    generationError: error,
    lastUpdatedAt: timestamp,
  };
}

export function applyFirstRunGenerationSuccess(current, { inputHash, payload, timestamp = nowIso() }) {
  if (current?.status !== "generate") return current;
  if (current?.inputHash !== inputHash) return current;
  return {
    ...current,
    generatedPlans: payload,
    generationError: null,
    selectedPlanId: null,
    status: "compare",
    lastUpdatedAt: timestamp,
  };
}

export function retryFirstRunGenerationState(current, timestamp = nowIso()) {
  if (current?.status !== "generate") return current;
  return {
    ...current,
    inputHash: null,
    generationError: null,
    lastUpdatedAt: timestamp,
  };
}
