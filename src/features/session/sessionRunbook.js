function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(min, value, max) {
  return Math.min(Math.max(value, min), max);
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

function normalizePositiveSeconds(value, fallback = 0) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next <= 0) return fallback;
  return Math.max(0, Math.round(next));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function limitText(value, maxLength, fallback = "") {
  const next = asString(value);
  if (!next) return fallback;
  return next.length > maxLength ? `${next.slice(0, maxLength - 1).trim()}…` : next;
}

function slugify(value, fallback = "item") {
  const next = asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return next || fallback;
}

function distributeMinutes(totalMinutes, count) {
  const total = normalizePositiveMinutes(totalMinutes, count || 1);
  const safeCount = Math.max(1, Math.min(total, Math.round(count || 1)));
  const base = Math.floor(total / safeCount);
  const remainder = total % safeCount;
  return Array.from({ length: safeCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function scaleMinuteBuckets(values, targetMinutes) {
  const safeValues = (Array.isArray(values) ? values : []).map((value) => normalizePositiveMinutes(value, 1));
  if (!safeValues.length) return [];
  const target = normalizePositiveMinutes(targetMinutes, safeValues.length);
  if (target <= safeValues.length) {
    return Array.from({ length: safeValues.length }, (_, index) => (index === 0 ? target - (safeValues.length - 1) : 1))
      .map((value) => Math.max(1, value));
  }

  const rawTotal = safeValues.reduce((sum, value) => sum + value, 0) || safeValues.length;
  const scaled = safeValues.map((value) => Math.max(1, Math.floor((value / rawTotal) * target)));
  let currentTotal = scaled.reduce((sum, value) => sum + value, 0);

  while (currentTotal < target) {
    let candidateIndex = 0;
    let bestRatio = -Infinity;
    scaled.forEach((value, index) => {
      const ratio = safeValues[index] / value;
      if (ratio > bestRatio) {
        bestRatio = ratio;
        candidateIndex = index;
      }
    });
    scaled[candidateIndex] += 1;
    currentTotal += 1;
  }

  while (currentTotal > target) {
    let candidateIndex = -1;
    let bestMargin = -Infinity;
    scaled.forEach((value, index) => {
      if (value <= 1) return;
      const margin = value - safeValues[index] / rawTotal;
      if (margin > bestMargin) {
        bestMargin = margin;
        candidateIndex = index;
      }
    });
    if (candidateIndex === -1) break;
    scaled[candidateIndex] -= 1;
    currentTotal -= 1;
  }

  return scaled;
}

function distributeStepMinutes(totalMinutes) {
  const total = normalizePositiveMinutes(totalMinutes, 20);
  if (total === 1) return [1];
  if (total === 2) return [1, 1];
  if (total === 3) return [1, 1, 1];

  const introTarget = total >= 25 ? 4 : total >= 15 ? 3 : 2;
  const outroTarget = total >= 10 ? 2 : 1;
  const intro = Math.min(introTarget, Math.max(1, total - 2));
  const remainingAfterIntro = total - intro;
  const outro = Math.min(outroTarget, Math.max(1, remainingAfterIntro - 1));
  const main = Math.max(1, total - intro - outro);
  return [intro, main, total - intro - main];
}

function normalizeSessionObjective(rawValue, fallback = null) {
  const source = isPlainObject(rawValue) ? rawValue : fallback;
  if (!isPlainObject(source)) return null;
  const why = limitText(source.why || fallback?.why, 160);
  const successDefinition = limitText(source.successDefinition || fallback?.successDefinition, 160);
  if (!why || !successDefinition) return null;
  return { why, successDefinition };
}

function buildFallbackObjective(blueprint) {
  return normalizeSessionObjective({
    why: blueprint?.why,
    successDefinition: blueprint?.successDefinition,
  });
}

export const PREPARED_SESSION_REJECTION_REASONS = Object.freeze({
  PROVIDER_PARSE_FAILED: "provider_parse_failed",
  RUNBOOK_SHAPE_FAILED: "runbook_shape_failed",
  RICHNESS_FAILED: "richness_failed",
  VALIDATION_FAILED: "validation_failed",
});

export const PREPARED_SESSION_REJECTION_STAGES = Object.freeze({
  PROVIDER_PARSE: "provider_parse",
  RUNBOOK_NORMALIZATION: "runbook_normalization",
  QUALITY_GATE: "quality_gate",
  RENDERABILITY: "renderability",
});

const PREMIUM_GENERIC_ITEM_LABELS = new Set([
  "activation generale",
  "mise en route",
  "passage principal",
  "relance courte",
  "rouvre le contexte",
  "premier passage utile",
  "passage critique",
  "trace exploitable",
  "noter la reprise",
  "nettoyer le contexte",
  "deuxieme passage",
  "sortie propre",
  "sortie controlee",
  "sequence utile",
  "enchainement principal",
  "amplitude controlee",
  "ouverture articulaire",
]);

function normalizeMatchText(value) {
  return asString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countMeaningfulSuccessCues(runbook) {
  const stepCues = runbook.steps.filter((step) => asString(step.successCue).length >= 8).length;
  const itemCues = runbook.steps.flatMap((step) => step.items).filter((item) => asString(item.successCue).length >= 8).length;
  return stepCues + itemCues;
}

function countNonGenericItemLabels(runbook) {
  return runbook.steps
    .flatMap((step) => step.items)
    .filter((item) => !PREMIUM_GENERIC_ITEM_LABELS.has(normalizeMatchText(item.label)))
    .length;
}

function countRunbookItems(runbook) {
  if (!runbook || !Array.isArray(runbook.steps)) return 0;
  return runbook.steps.reduce(
    (count, step) => count + (Array.isArray(step?.items) ? step.items.length : 0),
    0
  );
}

function isSportWarmupStep(step) {
  const stepText = normalizeMatchText(`${step?.label || ""} ${step?.purpose || ""}`);
  return /\b(echauff\w*|activation|mise en route|ouverture|mobilit\w*|prep\w*)\b/.test(stepText);
}

function isSportCooldownStep(step) {
  const stepText = normalizeMatchText(`${step?.label || ""} ${step?.purpose || ""}`);
  return /\b(retour|calme|recuper\w*|souffle|decompression|etirement\w*|redescente)\b/.test(stepText);
}

function isSportMainStep(step) {
  return !isSportWarmupStep(step) && !isSportCooldownStep(step);
}

function hasSportWorkTarget(item) {
  const guidance = normalizeMatchText(item?.guidance);
  return (
    (item?.restSec || 0) > 0 ||
    (item?.execution?.restSec || 0) > 0 ||
    asString(item?.execution?.reps).length > 0 ||
    (Number.isFinite(item?.execution?.durationSec) && item.execution.durationSec > 0) ||
    asString(item?.execution?.tempo).length > 0 ||
    /\b(\d+\s?(rep|reps|serie|series|sec|seconde|secondes|min|minute|minutes)|x\s?\d+|tempo)\b/.test(guidance)
  );
}

function hasSportTransitionSignal(item) {
  const transitionText = normalizeMatchText(`${item?.transitionLabel || ""} ${item?.guidance || ""}`);
  return (
    asString(item?.transitionLabel).length >= 4 ||
    (item?.restSec || 0) > 0 ||
    (item?.execution?.restSec || 0) > 0 ||
    /\b(ensuite|puis|avant de|entre chaque|entre les passages|recup|recuper|enchaine|alterne)\b/.test(
      transitionText
    )
  );
}

function hasSportSpecificRichness(runbook) {
  const items = runbook.steps.flatMap((step) => step.items);
  const mainBlockItems = runbook.steps.filter((step) => isSportMainStep(step)).flatMap((step) => step.items);
  const warmupItems = runbook.steps.filter((step) => isSportWarmupStep(step)).flatMap((step) => step.items);
  const cooldownItems = runbook.steps.filter((step) => isSportCooldownStep(step)).flatMap((step) => step.items);
  const labels = items.map((item) => normalizeMatchText(item.label));
  const guidance = items.map((item) => normalizeMatchText(item.guidance));
  const namedExerciseCount = labels.filter(
    (label) =>
      label.length >= 5 &&
      !PREMIUM_GENERIC_ITEM_LABELS.has(label) &&
      !["effort", "activation", "echauffement", "bloc principal", "bloc effort", "retour au calme"].includes(label)
  ).length;
  const quantifiedMainItemCount = mainBlockItems.filter((item) => hasSportWorkTarget(item)).length;
  const transitionSignalCount = items.filter((item) => hasSportTransitionSignal(item)).length;
  const cuefulMainItemCount = mainBlockItems.filter((item) => asString(item.successCue).length >= 8).length;
  const hasWarmup = runbook.steps.some((step) =>
    /\b(echauff\w*|activation|mise en route|ouverture|mobilit\w*)\b/.test(normalizeMatchText(step.label))
  );
  const hasCooldown = runbook.steps.some((step) =>
    /\b(retour|calme|recuperation|souffle|decompression|etirement\w*)\b/.test(normalizeMatchText(step.label))
  );
  const usefulGuidanceCount = guidance.filter((entry) => entry.length >= 20).length;
  return (
    hasWarmup &&
    hasCooldown &&
    mainBlockItems.length >= 2 &&
    warmupItems.length >= 2 &&
    cooldownItems.length >= 1 &&
    namedExerciseCount >= 4 &&
    quantifiedMainItemCount >= 2 &&
    transitionSignalCount >= 2 &&
    cuefulMainItemCount >= 2 &&
    usefulGuidanceCount >= 5
  );
}

function hasDeepWorkRichness(runbook) {
  const items = runbook.steps.flatMap((step) => step.items);
  const labels = items.map((item) => normalizeMatchText(item.label));
  const guidance = items.map((item) => normalizeMatchText(item.guidance));
  const hasConcreteSubdeliverable = labels.some(
    (label) =>
      label.length >= 10 &&
      !PREMIUM_GENERIC_ITEM_LABELS.has(label) &&
      !["ouverture", "bloc principal", "cloture"].includes(label)
  );
  const hasDeliverableSignal = guidance.some((entry) =>
    /\b(livrable|version|section|note|plan|preuve|trace|critere|critere de fin|sortie)\b/.test(entry)
  );
  const hasStructuredExecution = items.some(
    (item) =>
      asString(item.execution?.deliverable).length >= 8 ||
      asString(item.execution?.doneWhen).length >= 8
  );
  const hasRelaunchSignal =
    guidance.some((entry) => /\b(reprends|relance|reprendre|bloque|si tu bloques)\b/.test(entry)) ||
    items.some((item) => asString(item.execution?.relaunchCue).length >= 8);
  return hasConcreteSubdeliverable && (hasDeliverableSignal || hasStructuredExecution) && hasRelaunchSignal;
}

function hasAdminRichness(runbook) {
  const items = runbook.steps.flatMap((step) => step.items);
  const labels = items.map((item) => normalizeMatchText(item.label));
  const guidance = items.map((item) => normalizeMatchText(item.guidance));
  const hasConcreteAction = labels.some(
    (label) =>
      label.length >= 8 &&
      !PREMIUM_GENERIC_ITEM_LABELS.has(label) &&
      !["ouverture", "traitement", "cloture", "administration"].includes(label)
  );
  const hasCompletionSignal =
    guidance.some((entry) =>
      /\b(envoye|envoyer|archive|archiver|classe|classer|valide|valider|confirme|confirmer|ferme|fermer|mis a jour|preuve|sortie)\b/.test(entry)
    ) ||
    items.some((item) => asString(item.execution?.doneWhen).length >= 8);
  const hasRelaunchSignal =
    guidance.some((entry) => /\b(prochaine|suite|reprends|relance|si tu bloques|ensuite)\b/.test(entry)) ||
    items.some((item) => asString(item.execution?.relaunchCue).length >= 8);
  return hasConcreteAction && hasCompletionSignal && hasRelaunchSignal;
}

function hasGenericPremiumRichness(runbook) {
  const nonGenericItemLabels = countNonGenericItemLabels(runbook);
  const longGuidanceCount = runbook.steps
    .flatMap((step) => step.items)
    .filter((item) => asString(item.guidance).length >= 24)
    .length;
  return nonGenericItemLabels >= 4 && longGuidanceCount >= 4;
}

function normalizeIssuePaths(rawValue) {
  return (Array.isArray(rawValue) ? rawValue : [])
    .map((entry) => asString(entry))
    .filter(Boolean)
    .slice(0, 12);
}

export function createEmptyPreparedSessionQuality(overrides = {}) {
  return {
    isPremiumReady: null,
    validationPassed: null,
    richnessPassed: null,
    reason: null,
    rejectionReason: null,
    rejectionStage: null,
    stepCount: null,
    itemCount: null,
    issuePaths: [],
    ...overrides,
  };
}

export function normalizePreparedSessionQuality(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const validationPassed = typeof source.validationPassed === "boolean" ? source.validationPassed : null;
  const richnessPassed = typeof source.richnessPassed === "boolean" ? source.richnessPassed : null;
  const isPremiumReady = typeof source.isPremiumReady === "boolean" ? source.isPremiumReady : null;
  const rejectionReason = asString(source.rejectionReason || source.reason) || null;
  const reason = asString(source.reason) || rejectionReason || null;
  const rejectionStage = asString(source.rejectionStage) || null;
  const stepCount =
    Number.isFinite(source.stepCount) ? Math.max(0, Math.round(source.stepCount))
    : null;
  const itemCount =
    Number.isFinite(source.itemCount) ? Math.max(0, Math.round(source.itemCount))
    : null;
  return createEmptyPreparedSessionQuality({
    isPremiumReady,
    validationPassed,
    richnessPassed,
    reason,
    rejectionReason,
    rejectionStage,
    stepCount,
    itemCount,
    issuePaths: normalizeIssuePaths(source.issuePaths || source.zodIssuePaths),
  });
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

function detectSportPattern(title) {
  const normalized = asString(title)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (
    normalized.includes("yoga") ||
    normalized.includes("mobilite") ||
    normalized.includes("stretch") ||
    normalized.includes("etirement")
  ) {
    return "mobility";
  }
  if (
    normalized.includes("course") ||
    normalized.includes("run") ||
    normalized.includes("cardio") ||
    normalized.includes("marche")
  ) {
    return "cardio";
  }
  if (
    normalized.includes("gainage") ||
    normalized.includes("abdos") ||
    normalized.includes("renfo") ||
    normalized.includes("muscu") ||
    normalized.includes("circuit")
  ) {
    return "strength";
  }
  return "general";
}

function buildFallbackStepSpecs(protocolType, { title = "", blueprint = null } = {}) {
  if (protocolType === "sport") {
    const pattern = detectSportPattern(title);
    if (pattern === "mobility") {
      return [
        {
          label: "Échauffement",
          purpose: "ouvrir le corps sans forcer",
          successCue: "mouvement plus ample et respiration posée",
          items: [
            { kind: "activation", label: "Ouverture articulaire", guidance: "déroule nuque, épaules et hanches" },
            { kind: "warmup", label: "Mobilité douce", guidance: "mets de l’amplitude sans chercher l’intensité" },
          ],
        },
        {
          label: "Séquence centrale",
          purpose: "tenir la partie utile de la séance",
          successCue: "corps engagé sans tension excessive",
          items: [
            { kind: "sequence", label: "Enchaînement principal", guidance: "reste sur la séquence centrale prévue" },
            { kind: "sequence", label: "Amplitude contrôlée", guidance: "garde un rythme calme et continu" },
          ],
        },
        {
          label: "Retour au calme",
          purpose: "refermer la séance proprement",
          successCue: "respiration basse et corps relâché",
          items: [
            { kind: "cooldown", label: "Décompression", guidance: "relâche progressivement les zones sollicitées" },
            { kind: "breath", label: "Respiration finale", guidance: "ralentis jusqu’à retrouver un souffle calme" },
          ],
        },
      ];
    }

    if (pattern === "strength") {
      return [
        {
          label: "Échauffement",
          purpose: "mettre le corps en tension utile",
          successCue: "articulations prêtes et coeur un peu monté",
          items: [
            { kind: "activation", label: "Activation générale", guidance: "réveille épaules, hanches et tronc" },
            { kind: "warmup", label: "Montée en tension", guidance: "fais un premier passage léger" },
          ],
        },
        {
          label: "Bloc principal",
          purpose: "tenir le coeur de l’effort",
          successCue: "série utile tenue avec forme propre",
          items: [
            { kind: "effort", label: "Passage principal", guidance: "attaque la série la plus utile du bloc", restSec: 30 },
            { kind: "effort", label: "Deuxième passage", guidance: "reste propre, même si tu baisses légèrement le rythme", restSec: 30 },
            { kind: "effort", label: "Sortie contrôlée", guidance: "termine sans casser la technique" },
          ],
        },
        {
          label: "Retour au calme",
          purpose: "faire redescendre le système",
          successCue: "souffle récupéré et tension redescendue",
          items: [
            { kind: "cooldown", label: "Décompression", guidance: "secoue, marche ou relâche les groupes sollicités" },
            { kind: "breath", label: "Respiration", guidance: "revient à un rythme calme avant de finir" },
          ],
        },
      ];
    }

    if (pattern === "cardio") {
      return [
        {
          label: "Échauffement",
          purpose: "mettre le système en route",
          successCue: "rythme trouvé sans pic brutal",
          items: [
            { kind: "activation", label: "Mobilité rapide", guidance: "délie les articulations majeures" },
            { kind: "warmup", label: "Montée progressive", guidance: "augmente l’intensité en douceur" },
          ],
        },
        {
          label: "Bloc principal",
          purpose: "tenir l’intensité utile du jour",
          successCue: "rythme tenu sans te désunir",
          items: [
            { kind: "effort", label: "Rythme central", guidance: "stabilise l’allure qui fait avancer la séance", restSec: 20 },
            { kind: "effort", label: "Relance courte", guidance: "garde un peu de tonicité sans te cramer", restSec: 20 },
            { kind: "effort", label: "Sortie sous contrôle", guidance: "finis propre sans accélération inutile" },
          ],
        },
        {
          label: "Retour au calme",
          purpose: "faire redescendre progressivement",
          successCue: "souffle revenu et jambes légères",
          items: [
            { kind: "cooldown", label: "Décélération", guidance: "ralentis franchement le rythme" },
            { kind: "breath", label: "Respiration calme", guidance: "reprends un souffle régulier avant de couper" },
          ],
        },
      ];
    }

    return [
      {
        label: "Échauffement",
        purpose: "mettre le corps et l’attention en route",
        successCue: "corps chaud et disponibilité retrouvée",
        items: [
          { kind: "activation", label: "Activation articulaire", guidance: "réveille les zones qui vont travailler" },
          { kind: "warmup", label: "Montée en rythme", guidance: "passe doucement du calme à l’effort" },
        ],
      },
      {
        label: "Bloc principal",
        purpose: "tenir la partie utile de la séance",
        successCue: "bloc central tenu sans te disperser",
        items: [
          { kind: "effort", label: "Séquence utile", guidance: "reste sur le coeur du bloc prévu", restSec: 20 },
          { kind: "effort", label: "Relance contrôlée", guidance: "garde une intensité utile sans te crisper", restSec: 20 },
          { kind: "effort", label: "Sortie propre", guidance: "termine le bloc sans casser la forme" },
        ],
      },
      {
        label: "Retour au calme",
        purpose: "refermer le bloc proprement",
        successCue: "souffle posé et récupération enclenchée",
        items: [
          { kind: "cooldown", label: "Redescente", guidance: "ralentis franchement avant de couper" },
          { kind: "breath", label: "Respiration finale", guidance: "reviens à un souffle calme et stable" },
        ],
      },
    ];
  }

  if (protocolType === "deep_work") {
    return [
      {
        label: "Ouverture",
        purpose: "revenir dans le bon contexte de travail",
        successCue: "point d’entrée précis identifié",
        items: [
          { kind: "setup", label: "Rouvre le contexte", guidance: "remets sous les yeux uniquement ce qui sert le bloc" },
          { kind: "setup", label: "Fixe le point d’entrée", guidance: blueprint?.firstStep || "choisis la sous-partie exacte à attaquer" },
        ],
      },
      {
        label: "Bloc principal",
        purpose: "produire une avancée visible",
        successCue: "un sous-livrable concret existe",
        items: [
          { kind: "focus", label: "Premier passage utile", guidance: "travaille sans changer de sujet" },
          { kind: "focus", label: "Passage critique", guidance: "pousse jusqu’au point qui débloque vraiment le bloc" },
          { kind: "checkpoint", label: "Trace exploitable", guidance: "laisse quelque chose de réutilisable tout de suite" },
        ],
      },
      {
        label: "Clôture",
        purpose: "fermer sans perdre la reprise",
        successCue: "reprise future rendue évidente",
        items: [
          { kind: "close", label: "Note la reprise", guidance: "écris la prochaine sous-action avant de sortir" },
          { kind: "close", label: "Nettoie le contexte", guidance: "garde uniquement ce qui sert la prochaine reprise" },
        ],
      },
    ];
  }

  if (protocolType === "admin") {
    return [
      {
        label: "Ouverture",
        purpose: "lancer le lot sans friction",
        successCue: "ordre de traitement clair",
        items: [
          { kind: "setup", label: "Ouvre le lot", guidance: "rassemble uniquement les items à traiter maintenant" },
          { kind: "setup", label: "Choisis l’ordre", guidance: "attaque d’abord ce qui ferme le plus vite" },
        ],
      },
      {
        label: "Traitement",
        purpose: "vider le lot sans te disperser",
        successCue: "items fermés ou prochaine étape envoyée",
        items: [
          { kind: "process", label: "Fermeture simple", guidance: "termine les items évidents sans changer de contexte" },
          { kind: "process", label: "Passage utile", guidance: "traite ensuite l’item qui retire le plus de friction" },
          { kind: "process", label: "Sortie envoyée", guidance: "envoie ou consigne la prochaine étape si besoin" },
        ],
      },
      {
        label: "Clôture",
        purpose: "laisser un état net",
        successCue: "aucun flou sur la suite",
        items: [
          { kind: "close", label: "Vérification finale", guidance: "assure-toi que rien d’urgent ne reste flottant" },
          { kind: "close", label: "Suite notée", guidance: "laisse la prochaine action visible si le lot continue" },
        ],
      },
    ];
  }

  if (protocolType === "routine") {
    return [
      {
        label: "Mise en route",
        purpose: "entrer sans négocier",
        successCue: "version minimum effectivement lancée",
        items: [
          { kind: "setup", label: "Version minimum", guidance: "commence par le niveau le plus léger crédible" },
          { kind: "setup", label: "Installation", guidance: "mets-toi dans la posture qui soutient la régularité" },
        ],
      },
      {
        label: "Bloc central",
        purpose: "tenir le rythme de la routine",
        successCue: "séquence centrale tenue sans rupture",
        items: [
          { kind: "routine", label: "Rythme central", guidance: "reste sur le coeur de la routine sans varier" },
          { kind: "routine", label: "Passage complet", guidance: "termine la séquence prévue sans te disperser" },
        ],
      },
      {
        label: "Clôture",
        purpose: "valider la continuité",
        successCue: "routine fermée proprement",
        items: [
          { kind: "close", label: "Validation", guidance: "marque clairement que le bloc est tenu" },
          { kind: "close", label: "Sortie calme", guidance: "ferme sans casser l’élan de régularité" },
        ],
      },
    ];
  }

  return [
    {
      label: "Lancement",
      purpose: "ouvrir le bon point d’entrée",
      successCue: "premier pas concret enclenché",
      items: [
        { kind: "setup", label: "Point d’entrée", guidance: blueprint?.firstStep || "ouvre le plus petit point d’entrée concret" },
        { kind: "setup", label: "Mise en route", guidance: "coupe le reste et garde seulement ce qui sert ce bloc" },
      ],
    },
    {
      label: "Bloc principal",
      purpose: "faire avancer le coeur de la séance",
      successCue: "progression visible sur le vrai sujet",
      items: [
        { kind: "focus", label: "Premier passage utile", guidance: "attaque le coeur du bloc sans te disperser" },
        { kind: "focus", label: "Progression visible", guidance: "continue jusqu’à obtenir un résultat net" },
      ],
    },
    {
      label: "Clôture",
      purpose: "sortir avec une suite claire",
      successCue: "prochaine reprise déjà préparée",
      items: [
        { kind: "close", label: "Nettoyage de sortie", guidance: "ferme le bloc sans laisser de flou" },
        { kind: "close", label: "Suite notée", guidance: "écris la prochaine reprise avant de quitter" },
      ],
    },
  ];
}

function materializeStep(stepSpec, stepIndex, stepMinutes, runbookIdSeed = "runbook") {
  const itemSpecs = Array.isArray(stepSpec?.items) && stepSpec.items.length ? stepSpec.items : [
    {
      kind: "task",
      label: stepSpec?.label || `Étape ${stepIndex + 1}`,
      guidance: stepSpec?.purpose || "",
    },
  ];
  const safeStepMinutes = normalizePositiveMinutes(stepMinutes, itemSpecs.length);
  const usableItemSpecs =
    safeStepMinutes < itemSpecs.length ? itemSpecs.slice(0, safeStepMinutes) : itemSpecs;
  const itemMinuteBuckets = scaleMinuteBuckets(
    distributeMinutes(safeStepMinutes, usableItemSpecs.length),
    safeStepMinutes
  );

  const stepId = `${runbookIdSeed}_step_${stepIndex + 1}`;
  const items = usableItemSpecs.map((itemSpec, itemIndex) => ({
    id: `${stepId}_${slugify(itemSpec.label, `item_${itemIndex + 1}`)}`,
    kind: asString(itemSpec.kind || "task").toLowerCase() || "task",
    label: limitText(itemSpec.label, 56, `Item ${itemIndex + 1}`),
    minutes: itemMinuteBuckets[itemIndex],
    guidance: limitText(itemSpec.guidance, 160, stepSpec?.purpose || ""),
    successCue: limitText(itemSpec.successCue, 120, stepSpec?.successCue || ""),
    restSec: normalizePositiveSeconds(itemSpec.restSec, 0),
    transitionLabel: limitText(itemSpec.transitionLabel, 80, ""),
  }));

  return {
    id: stepId,
    label: limitText(stepSpec?.label, 56, `Étape ${stepIndex + 1}`),
    purpose: limitText(stepSpec?.purpose, 120, ""),
    minutes: items.reduce((sum, item) => sum + item.minutes, 0),
    successCue: limitText(stepSpec?.successCue, 120, ""),
    items,
  };
}

function createFallbackRunbook({
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
  const stepSpecs = buildFallbackStepSpecs(blueprint.protocolType, { title, blueprint });
  const stepMinuteBuckets = scaleMinuteBuckets(distributeStepMinutes(durationMinutes), durationMinutes);
  const runbookIdSeed = `${slugify(actionId, "goal")}_${slugify(occurrenceId, "occ")}`;
  const steps = stepSpecs.map((stepSpec, index) =>
    materializeStep(stepSpec, index, stepMinuteBuckets[index] || 1, runbookIdSeed)
  );

  return {
    version: 1,
    source: "deterministic_fallback",
    protocolType: blueprint.protocolType,
    occurrenceId,
    actionId,
    dateKey: asString(occurrence?.date),
    title,
    categoryName,
    durationMinutes,
    objective: buildFallbackObjective(blueprint),
    steps,
  };
}

function normalizeRunbookExecution(rawValue, { fallback = null } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : fallback;
  if (!isPlainObject(source)) return null;

  const repsRaw = source.reps ?? fallback?.reps;
  const reps =
    typeof repsRaw === "string" ? limitText(repsRaw, 32, "")
    : Number.isFinite(repsRaw) && repsRaw > 0 ? String(Math.round(repsRaw))
    : "";
  const durationSecRaw = source.durationSec ?? fallback?.durationSec;
  const durationSec =
    Number.isFinite(durationSecRaw) && durationSecRaw > 0 ? normalizePositiveSeconds(durationSecRaw, 0) : 0;
  const tempo = limitText(source.tempo || fallback?.tempo, 32, "");
  const deliverable = limitText(source.deliverable || fallback?.deliverable, 160, "");
  const doneWhen = limitText(source.doneWhen || fallback?.doneWhen, 160, "");
  const relaunchCue = limitText(source.relaunchCue || fallback?.relaunchCue, 160, "");
  const restSecRaw = source.restSec ?? fallback?.restSec;
  const restSec =
    Number.isFinite(restSecRaw) && restSecRaw > 0 ? normalizePositiveSeconds(restSecRaw, 0) : 0;

  if (!reps && !durationSec && !tempo && !deliverable && !doneWhen && !relaunchCue && !restSec) return null;

  const execution = {};
  if (reps) execution.reps = reps;
  if (durationSec) execution.durationSec = durationSec;
  if (tempo) execution.tempo = tempo;
  if (deliverable) execution.deliverable = deliverable;
  if (doneWhen) execution.doneWhen = doneWhen;
  if (relaunchCue) execution.relaunchCue = relaunchCue;
  if (restSec) execution.restSec = restSec;
  return execution;
}

function normalizeRunbookItem(rawValue, { fallback = null, itemId = "" } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : fallback;
  if (!isPlainObject(source)) return null;
  const label = limitText(source.label || fallback?.label, 56);
  const guidance = limitText(source.guidance || fallback?.guidance, 160);
  if (!label || !guidance) return null;
  const execution = normalizeRunbookExecution(source.execution || fallback?.execution || null);
  const normalized = {
    id: asString(source.id || fallback?.id) || itemId || slugify(label, "item"),
    kind: asString(source.kind || fallback?.kind || "task").toLowerCase() || "task",
    label,
    minutes: normalizePositiveMinutes(source.minutes ?? fallback?.minutes, 1),
    guidance,
    successCue: limitText(source.successCue || fallback?.successCue, 120, ""),
    restSec: normalizePositiveSeconds(source.restSec ?? fallback?.restSec, 0),
    transitionLabel: limitText(source.transitionLabel || fallback?.transitionLabel, 80, ""),
  };
  if (execution) normalized.execution = execution;
  return normalized;
}

function normalizeRunbookStep(rawValue, { fallback = null, stepIndex = 0, runbookSeed = "runbook" } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : fallback;
  if (!isPlainObject(source)) return null;
  const label = limitText(source.label || fallback?.label, 56);
  const purpose = limitText(source.purpose || fallback?.purpose, 120, "");
  const successCue = limitText(source.successCue || fallback?.successCue, 120, "");
  if (!label) return null;

  const rawItems = Array.isArray(source.items) && source.items.length ? source.items : fallback?.items || [];
  const items = rawItems
    .slice(0, 4)
    .map((item, itemIndex) =>
      normalizeRunbookItem(item, {
        fallback: fallback?.items?.[itemIndex] || null,
        itemId: `${runbookSeed}_step_${stepIndex + 1}_item_${itemIndex + 1}`,
      })
    )
    .filter(Boolean);

  if (!items.length) return null;
  return {
    id:
      asString(source.id || fallback?.id) ||
      `${runbookSeed}_step_${stepIndex + 1}_${slugify(label, `step_${stepIndex + 1}`)}`,
    label,
    purpose,
    minutes: items.reduce((sum, item) => sum + item.minutes, 0),
    successCue,
    items,
  };
}

function normalizeRunbookShape(rawValue, { fallback = null } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : fallback;
  if (!isPlainObject(source)) return null;

  const fallbackRunbook = isPlainObject(fallback) ? fallback : null;
  const version = Number(source.version || fallbackRunbook?.version || 1);
  if (version !== 1 && version !== 2) return null;

  const title = limitText(source.title || fallbackRunbook?.title, 96, "Session");
  const occurrenceId = asString(source.occurrenceId || fallbackRunbook?.occurrenceId);
  const actionId = asString(source.actionId || fallbackRunbook?.actionId);
  if (!occurrenceId || !actionId || !title) return null;

  const objective = normalizeSessionObjective(source.objective, fallbackRunbook?.objective);
  if (!objective) return null;

  const protocolType = normalizeProtocolType(source.protocolType || fallbackRunbook?.protocolType);
  const runbookSeed = `${slugify(actionId, "goal")}_${slugify(occurrenceId, "occ")}`;
  const steps = (Array.isArray(source.steps) ? source.steps : fallbackRunbook?.steps || [])
    .slice(0, version === 2 ? 5 : 4)
    .map((step, stepIndex) =>
      normalizeRunbookStep(step, {
        fallback: fallbackRunbook?.steps?.[stepIndex] || null,
        stepIndex,
        runbookSeed,
      })
    )
    .filter(Boolean);
  const totalItems = steps.reduce((count, step) => count + step.items.length, 0);
  if (!steps.length || totalItems < 1 || totalItems > 12) return null;

  return {
    version,
    source: version === 2 ? "ai_prepared" : asString(source.source || fallbackRunbook?.source) || "deterministic_fallback",
    protocolType,
    occurrenceId,
    actionId,
    dateKey: asString(source.dateKey || fallbackRunbook?.dateKey),
    title,
    categoryName: limitText(source.categoryName || fallbackRunbook?.categoryName, 56, ""),
    durationMinutes: steps.reduce((sum, step) => sum + step.minutes, 0),
    objective,
    steps,
  };
}

export function normalizeSessionRunbook(rawValue, { fallback = null } = {}) {
  return normalizeRunbookShape(rawValue, { fallback });
}

export function normalizePreparedSessionRunbook(rawValue, { fallbackRunbook = null } = {}) {
  const fallback = normalizeSessionRunbook(fallbackRunbook);
  const normalized = normalizeRunbookShape(rawValue, { fallback });
  if (!normalized || normalized.version !== 2) return null;
  if (normalized.steps.length < 3 || normalized.steps.length > 5) return null;
  const itemCount = normalized.steps.reduce((count, step) => count + step.items.length, 0);
  if (itemCount < 6 || itemCount > 12) return null;
  return normalized;
}

export function assessPreparedSessionRunbookQuality({
  preparedRunbook = null,
  quality = null,
  fallbackRunbook = null,
} = {}) {
  const normalizedRunbook = normalizePreparedSessionRunbook(preparedRunbook, { fallbackRunbook });
  const providedQuality = normalizePreparedSessionQuality(quality);
  if (!normalizedRunbook) {
    return createEmptyPreparedSessionQuality({
      validationPassed: false,
      richnessPassed: false,
      reason: providedQuality.reason || PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED,
      rejectionReason:
        providedQuality.rejectionReason || PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED,
      rejectionStage:
        providedQuality.rejectionStage || PREPARED_SESSION_REJECTION_STAGES.RUNBOOK_NORMALIZATION,
      stepCount: providedQuality.stepCount,
      itemCount: providedQuality.itemCount,
      issuePaths: providedQuality.issuePaths,
    });
  }

  const protocolType = normalizeProtocolType(normalizedRunbook.protocolType);
  const meaningfulCueCount = countMeaningfulSuccessCues(normalizedRunbook);
  const nonGenericItemLabels = countNonGenericItemLabels(normalizedRunbook);
  const stepCount = normalizedRunbook.steps.length;
  const itemCount = countRunbookItems(normalizedRunbook);

  let localRichnessPassed = meaningfulCueCount >= 2 && nonGenericItemLabels >= 4;
  if (protocolType === "sport") {
    localRichnessPassed = localRichnessPassed && hasSportSpecificRichness(normalizedRunbook);
  } else if (protocolType === "deep_work") {
    localRichnessPassed = localRichnessPassed && hasDeepWorkRichness(normalizedRunbook);
  } else if (protocolType === "admin") {
    localRichnessPassed = localRichnessPassed && hasAdminRichness(normalizedRunbook);
  } else {
    localRichnessPassed = localRichnessPassed && hasGenericPremiumRichness(normalizedRunbook);
  }

  const validationPassed = providedQuality.validationPassed !== false;
  const richnessPassed = providedQuality.richnessPassed !== false && localRichnessPassed;
  const isPremiumReady =
    providedQuality.isPremiumReady !== false &&
    validationPassed &&
    richnessPassed;
  const rejectionReason =
    isPremiumReady
      ? null
      : providedQuality.rejectionReason ||
        providedQuality.reason ||
        (!validationPassed
          ? PREPARED_SESSION_REJECTION_REASONS.VALIDATION_FAILED
          : PREPARED_SESSION_REJECTION_REASONS.RICHNESS_FAILED);
  const rejectionStage =
    isPremiumReady
      ? null
      : providedQuality.rejectionStage ||
        (!validationPassed
          ? PREPARED_SESSION_REJECTION_STAGES.RUNBOOK_NORMALIZATION
          : PREPARED_SESSION_REJECTION_STAGES.QUALITY_GATE);

  return createEmptyPreparedSessionQuality({
    isPremiumReady,
    validationPassed,
    richnessPassed,
    reason: rejectionReason,
    rejectionReason,
    rejectionStage,
    stepCount: providedQuality.stepCount ?? stepCount,
    itemCount: providedQuality.itemCount ?? itemCount,
    issuePaths: providedQuality.issuePaths,
  });
}

export function resolvePreparedSessionRunbookQuality({
  preparedRunbook = null,
  quality = null,
  fallbackRunbook = null,
} = {}) {
  const normalizedRunbook = normalizePreparedSessionRunbook(preparedRunbook, { fallbackRunbook });
  const providedQuality = normalizePreparedSessionQuality(quality);
  const hasProvidedDecision =
    providedQuality.isPremiumReady !== null ||
    providedQuality.validationPassed !== null ||
    providedQuality.richnessPassed !== null ||
    Boolean(providedQuality.reason || providedQuality.rejectionReason);

  if (!hasProvidedDecision) {
    return assessPreparedSessionRunbookQuality({
      preparedRunbook,
      quality: null,
      fallbackRunbook,
    });
  }

  if (!normalizedRunbook) {
    return createEmptyPreparedSessionQuality({
      validationPassed: false,
      richnessPassed: false,
      reason: providedQuality.reason || PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED,
      rejectionReason:
        providedQuality.rejectionReason || PREPARED_SESSION_REJECTION_REASONS.RUNBOOK_SHAPE_FAILED,
      rejectionStage:
        providedQuality.rejectionStage || PREPARED_SESSION_REJECTION_STAGES.RENDERABILITY,
      stepCount: providedQuality.stepCount,
      itemCount: providedQuality.itemCount,
      issuePaths: providedQuality.issuePaths,
    });
  }

  const validationPassed = providedQuality.validationPassed !== false;
  const richnessPassed = validationPassed && providedQuality.richnessPassed === true;
  const isPremiumReady =
    providedQuality.isPremiumReady === true &&
    validationPassed &&
    richnessPassed;
  const rejectionReason =
    isPremiumReady
      ? null
      : providedQuality.rejectionReason ||
        providedQuality.reason ||
        (!validationPassed
          ? PREPARED_SESSION_REJECTION_REASONS.VALIDATION_FAILED
          : PREPARED_SESSION_REJECTION_REASONS.RICHNESS_FAILED);
  const rejectionStage =
    isPremiumReady
      ? null
      : providedQuality.rejectionStage ||
        (!validationPassed
          ? PREPARED_SESSION_REJECTION_STAGES.RENDERABILITY
          : PREPARED_SESSION_REJECTION_STAGES.QUALITY_GATE);

  return createEmptyPreparedSessionQuality({
    isPremiumReady,
    validationPassed,
    richnessPassed,
    reason: rejectionReason,
    rejectionReason,
    rejectionStage,
    stepCount: providedQuality.stepCount ?? normalizedRunbook.steps.length,
    itemCount: providedQuality.itemCount ?? countRunbookItems(normalizedRunbook),
    issuePaths: providedQuality.issuePaths,
  });
}

export function summarizeSessionRunbookPatch(sessionRunbook = null) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook) return null;
  return {
    version: runbook.version,
    stepCount: runbook.steps.length,
    itemCount: countRunbookItems(runbook),
  };
}

export function buildSessionRunbookV1({
  blueprintSnapshot = null,
  occurrence = null,
  action = null,
  category = null,
} = {}) {
  return createFallbackRunbook({ blueprintSnapshot, occurrence, action, category });
}

function flattenRunbookItems(steps) {
  const flattened = [];
  steps.forEach((step, stepIndex) => {
    step.items.forEach((item, itemIndex) => {
      flattened.push({
        stepId: step.id,
        stepIndex,
        stepLabel: step.label,
        stepPurpose: step.purpose,
        stepSuccessCue: step.successCue,
        stepMinutes: step.minutes,
        itemIndex,
        item,
      });
    });
  });
  return flattened;
}

export function deriveGuidedCurrentStep({
  sessionRunbook = null,
  sessionRunbookV1 = null,
  elapsedSec = 0,
} = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook, { fallback: sessionRunbookV1 });
  const steps = Array.isArray(runbook?.steps) ? runbook.steps.filter(Boolean) : [];
  if (!runbook || !steps.length) return null;

  const flattenedItems = flattenRunbookItems(steps);
  if (!flattenedItems.length) return null;

  const safeElapsedSec = Number.isFinite(elapsedSec) ? Math.max(0, elapsedSec) : 0;
  let absoluteItemIndex = flattenedItems.length - 1;
  let threshold = 0;

  for (let index = 0; index < flattenedItems.length; index += 1) {
    threshold += Math.max(0, Number(flattenedItems[index]?.item?.minutes || 0)) * 60;
    if (safeElapsedSec < threshold) {
      absoluteItemIndex = index;
      break;
    }
  }

  const current = flattenedItems[absoluteItemIndex];
  const previousThreshold = flattenedItems
    .slice(0, absoluteItemIndex)
    .reduce((sum, entry) => sum + Math.max(0, Number(entry?.item?.minutes || 0)) * 60, 0);
  const currentItemDurationSec = Math.max(60, Math.round((current?.item?.minutes || 1) * 60));
  const elapsedWithinItemSec = clamp(0, safeElapsedSec - previousThreshold, currentItemDurationSec);
  const remainingWithinItemSec = Math.max(currentItemDurationSec - elapsedWithinItemSec, 0);
  const nextFlatItem = flattenedItems[absoluteItemIndex + 1] || null;
  const currentStep = steps[current.stepIndex];

  return {
    title: runbook.title,
    totalSteps: steps.length,
    totalItems: flattenedItems.length,
    currentStepIndex: current.stepIndex,
    currentStep,
    currentItemIndex: current.itemIndex,
    currentItem: current.item,
    absoluteItemIndex,
    currentItemProgress01: currentItemDurationSec > 0 ? elapsedWithinItemSec / currentItemDurationSec : 0,
    elapsedWithinItemSec,
    remainingWithinItemSec,
    nextItem: nextFlatItem
      ? {
          ...nextFlatItem.item,
          stepLabel: nextFlatItem.stepLabel,
          stepIndex: nextFlatItem.stepIndex,
        }
      : null,
    steps: steps.map((step, stepIndex) => ({
      ...step,
      state:
        stepIndex < current.stepIndex ? "done" : stepIndex === current.stepIndex ? "current" : "upcoming",
      items: step.items.map((item, itemIndex) => {
        if (stepIndex < current.stepIndex) return { ...item, state: "done" };
        if (stepIndex > current.stepIndex) return { ...item, state: "upcoming" };
        if (itemIndex < current.itemIndex) return { ...item, state: "done" };
        if (itemIndex === current.itemIndex) return { ...item, state: "current" };
        return { ...item, state: "upcoming" };
      }),
    })),
  };
}
