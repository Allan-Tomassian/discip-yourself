function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeProtocolType(value) {
  const next = asString(value).toLowerCase();
  if (next === "sport") return "sport";
  if (next === "deep_work") return "deep_work";
  if (next === "admin") return "admin";
  if (next === "routine") return "routine";
  return "generic";
}

function normalizePositiveMinutes(value, fallback = 20) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.max(1, Math.round(next));
}

export function normalizeSessionBlueprintSnapshot(rawValue) {
  const source = rawValue && typeof rawValue === "object" ? rawValue : null;
  if (!source) return null;
  const why = asString(source.why);
  const firstStep = asString(source.firstStep);
  const ifBlocked = asString(source.ifBlocked);
  const successDefinition = asString(source.successDefinition);
  if (!why || !firstStep || !ifBlocked || !successDefinition) return null;
  return {
    version: 1,
    protocolType: normalizeProtocolType(source.protocolType),
    why,
    firstStep,
    ifBlocked,
    successDefinition,
    estimatedMinutes: normalizePositiveMinutes(source.estimatedMinutes, 20),
  };
}

function resolveRunbookTemplate(protocolType) {
  if (protocolType === "sport") {
    return {
      labels: ["Échauffement", "Phase principale", "Retour au calme"],
      guidance: [
        "Mobilité articulaire et activation légère",
        "Reste sur la séquence utile du bloc",
        "Ralentis et ferme proprement",
      ],
    };
  }
  if (protocolType === "deep_work") {
    return {
      labels: ["Ouverture", "Bloc principal", "Clôture"],
      guidance: [
        "Rouvre la sous-partie exacte et coupe le reste",
        "Travaille jusqu’à une avancée visible",
        "Laisse une reprise nette",
      ],
    };
  }
  if (protocolType === "admin") {
    return {
      labels: ["Ouverture", "Traitement", "Clôture"],
      guidance: [
        "Ouvre l’item le plus simple à fermer",
        "Vide le lot sans te disperser",
        "Envoie ou note la prochaine étape",
      ],
    };
  }
  if (protocolType === "routine") {
    return {
      labels: ["Mise en route", "Bloc central", "Clôture"],
      guidance: [
        "Lance la version minimum sans négocier",
        "Tiens le rythme sans changer de contexte",
        "Valide puis ferme le bloc",
      ],
    };
  }
  return {
    labels: ["Lancement", "Bloc principal", "Clôture"],
    guidance: [
      "Ouvre le plus petit point d’entrée concret",
      "Avance jusqu’à un résultat visible",
      "Note la suite avant de sortir",
    ],
  };
}

function distributeStepMinutes(totalMinutes) {
  const total = normalizePositiveMinutes(totalMinutes, 20);
  if (total === 1) return [1, 0, 0];
  if (total === 2) return [1, 1, 0];
  if (total === 3) return [1, 1, 1];

  const introTarget = total >= 25 ? 4 : total >= 15 ? 3 : 2;
  const outroTarget = total >= 10 ? 2 : 1;
  const intro = Math.min(introTarget, Math.max(1, total - 2));
  const remainingAfterIntro = total - intro;
  const outro = Math.min(outroTarget, Math.max(1, remainingAfterIntro - 1));
  const main = Math.max(1, total - intro - outro);
  return [intro, main, total - intro - main];
}

export function buildSessionRunbookV1({
  blueprintSnapshot = null,
  occurrence = null,
  action = null,
  category = null,
} = {}) {
  const blueprint = normalizeSessionBlueprintSnapshot(blueprintSnapshot);
  const occurrenceId = asString(occurrence?.id);
  const actionId = asString(action?.id || occurrence?.goalId);
  const title = asString(action?.title || occurrence?.title) || "Session";
  if (!blueprint || !occurrenceId || !actionId || !title) return null;

  const durationMinutes = normalizePositiveMinutes(
    occurrence?.durationMinutes ?? blueprint.estimatedMinutes ?? action?.sessionMinutes,
    20
  );
  const categoryName = asString(category?.name);
  const [introMinutes, mainMinutes, outroMinutes] = distributeStepMinutes(durationMinutes);
  const template = resolveRunbookTemplate(blueprint.protocolType);
  const minuteBuckets = [introMinutes, mainMinutes, outroMinutes];
  const steps = template.labels.map((label, index) => ({
    id: `step_${index + 1}`,
    label,
    minutes: minuteBuckets[index],
    guidance: template.guidance[index],
  }));

  return {
    version: 1,
    source: "local_blueprint_derivation",
    protocolType: blueprint.protocolType,
    occurrenceId,
    actionId,
    dateKey: asString(occurrence?.date),
    title,
    categoryName,
    durationMinutes,
    steps,
  };
}

export function deriveGuidedCurrentStep({ sessionRunbookV1 = null, elapsedSec = 0 } = {}) {
  const runbook = sessionRunbookV1 && typeof sessionRunbookV1 === "object" ? sessionRunbookV1 : null;
  const steps = Array.isArray(runbook?.steps) ? runbook.steps.filter(Boolean) : [];
  if (!runbook || !steps.length) return null;

  const safeElapsedSec = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  let currentStepIndex = steps.length - 1;
  let threshold = 0;
  for (let index = 0; index < steps.length; index += 1) {
    threshold += Math.max(0, Number(steps[index]?.minutes || 0)) * 60;
    if (safeElapsedSec < threshold) {
      currentStepIndex = index;
      break;
    }
  }

  return {
    title: runbook.title,
    totalSteps: steps.length,
    currentStepIndex,
    currentStep: steps[currentStepIndex],
    steps: steps.map((step, index) => ({
      ...step,
      state: index < currentStepIndex ? "done" : index === currentStepIndex ? "current" : "upcoming",
    })),
  };
}
