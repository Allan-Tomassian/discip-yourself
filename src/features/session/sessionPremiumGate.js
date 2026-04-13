function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function limitText(value, maxLength, fallback = "") {
  const next = asString(value);
  if (!next) return fallback;
  return next.length > maxLength ? `${next.slice(0, maxLength - 1).trim()}…` : next;
}

function pickPremiumBenefit(protocolType = "") {
  if (protocolType === "sport") return "séquencement précis, repères de réussite et transitions guidées";
  if (protocolType === "deep_work") return "sous-livrables clairs, ordre d’exécution et relances utiles";
  if (protocolType === "admin") return "ordre de traitement, clôture nette et prochaines étapes claires";
  if (protocolType === "routine") return "version minimum crédible, progression tenue et sortie propre";
  return "séquencement détaillé, repères utiles et guidance d’exécution";
}

export function resolveSessionPremiumGateDecision(entitlementAccess = null) {
  const status = entitlementAccess?.status || "unknown";
  if (status === "premium" || status === "founder") return "premium";
  if (status === "free") return "locked_preview";
  if (status === "error") return "access_error";
  return "checking_access";
}

export function buildBoundedPremiumSessionPreview({
  fallbackRunbook = null,
  blueprintSnapshot = null,
  actionTitle = "",
  durationMinutes = null,
} = {}) {
  const runbook = isPlainObject(fallbackRunbook) ? fallbackRunbook : null;
  const objective = isPlainObject(runbook?.objective)
    ? runbook.objective
    : isPlainObject(blueprintSnapshot)
      ? {
          why: asString(blueprintSnapshot.why),
          successDefinition: asString(blueprintSnapshot.successDefinition),
        }
      : null;
  const steps = Array.isArray(runbook?.steps) ? runbook.steps.slice(0, 3) : [];
  const previewSteps = steps.map((step) => ({
    label: limitText(step?.label, 56, "Phase"),
    purpose: limitText(step?.purpose, 120, ""),
    example:
      limitText(
        Array.isArray(step?.items) && step.items[0]
          ? `${asString(step.items[0].label)}${asString(step.items[0].guidance) ? " · " : ""}${asString(step.items[0].guidance)}`
          : "",
        140,
        ""
      ),
  }));
  const totalDuration =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? Math.round(durationMinutes)
      : Number.isFinite(runbook?.durationMinutes) && runbook.durationMinutes > 0
        ? Math.round(runbook.durationMinutes)
        : null;
  return {
    title: limitText(actionTitle || runbook?.title, 96, "Session"),
    objectiveWhy: limitText(objective?.why, 160, ""),
    successDefinition: limitText(objective?.successDefinition, 160, ""),
    totalDuration,
    premiumBenefit: pickPremiumBenefit(asString(runbook?.protocolType || blueprintSnapshot?.protocolType).toLowerCase()),
    steps: previewSteps,
  };
}
