const ENTRY_STATES = new Set(["ready", "locked", "quota_exhausted", "running"]);

function normalizeAvailabilityState(value) {
  const state = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ENTRY_STATES.has(state) ? state : "ready";
}

function getFirstMissingReason(eligibility) {
  const firstMissing = Array.isArray(eligibility?.missingRequirements)
    ? eligibility.missingRequirements[0]
    : null;
  if (typeof firstMissing?.label === "string" && firstMissing.label.trim()) {
    return firstMissing.label.trim();
  }
  if (typeof eligibility?.unlockCopy === "string" && eligibility.unlockCopy.trim()) {
    return eligibility.unlockCopy.trim();
  }
  return "Analyse disponible après quelques jours d’exécution.";
}

export function buildSystemAnalysisEntryModel({
  eligibility,
  availabilityState = "ready",
} = {}) {
  const state = normalizeAvailabilityState(availabilityState);

  if (state === "running") {
    return {
      visible: true,
      enabled: false,
      state: "running",
      tone: "ai",
      label: "Analyse en cours…",
      title: "Analyse système",
      reason: "Analyse premium en cours.",
      ariaLabel: "Analyse système en cours",
    };
  }

  if (state === "quota_exhausted") {
    return {
      visible: true,
      enabled: false,
      state: "quota_exhausted",
      tone: "ai",
      label: "Analyse utilisée",
      title: "Analyse système",
      reason: "Quota mensuel utilisé.",
      ariaLabel: "Analyse système indisponible, quota mensuel utilisé",
    };
  }

  if (eligibility?.eligible === true && state !== "locked") {
    return {
      visible: true,
      enabled: true,
      state: "available",
      tone: "ai",
      label: "Analyser le système",
      title: "Analyser le système",
      reason: "Analyse premium disponible.",
      ariaLabel: "Analyser le système avec l’analyse premium",
    };
  }

  const reason = getFirstMissingReason(eligibility);
  return {
    visible: true,
    enabled: false,
    state: "locked",
    tone: "ai",
    label: "Analyse système",
    title: "Analyse système verrouillée",
    reason,
    ariaLabel: `Analyse système verrouillée, ${reason}`,
  };
}
