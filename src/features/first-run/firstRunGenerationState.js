function nowIso() {
  return new Date().toISOString();
}

function resolveAutoSelectedPlanId(generatedPlans, fallback = null) {
  const plans = Array.isArray(generatedPlans?.plans) ? generatedPlans.plans : [];
  if (plans.some((plan) => plan?.id === "recommended")) return "recommended";
  if (plans.length === 1 && plans[0]?.id) return plans[0].id;
  return fallback;
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
    selectedPlanId: resolveAutoSelectedPlanId(current.generatedPlans, current.selectedPlanId),
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
    selectedPlanId: resolveAutoSelectedPlanId(payload, null),
    status: "compare",
    lastUpdatedAt: timestamp,
  };
}

export function applyFirstRunRecommendedPlanSuccess(current, { inputHash, payload, timestamp = nowIso() }) {
  if (current?.status !== "generate") return current;
  return {
    ...current,
    inputHash,
    generatedPlans: payload,
    generationError: null,
    selectedPlanId: resolveAutoSelectedPlanId(payload, "recommended"),
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
