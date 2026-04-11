import { normalizeSessionRunbook } from "./sessionRunbook";

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(min, value, max) {
  return Math.min(Math.max(value, min), max);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizePositiveSeconds(value, fallback = 0) {
  const next = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(next) || next < 0) return fallback;
  return Math.max(0, Math.round(next));
}

function readProtocolType(value) {
  const next = asString(value).toLowerCase();
  if (next === "sport") return "sport";
  if (next === "deep_work") return "deep_work";
  if (next === "admin") return "admin";
  if (next === "routine") return "routine";
  return "generic";
}

function readItemKinds(step, item) {
  return [step?.label, step?.purpose, item?.kind, item?.label, item?.guidance]
    .map((value) => asString(value).toLowerCase())
    .join(" ");
}

function titleCase(value) {
  const source = asString(value);
  if (!source) return "";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function buildCopyText(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => asString(line))
    .filter(Boolean)
    .join("\n");
}

function formatSeconds(seconds) {
  const safe = normalizePositiveSeconds(seconds, 0);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function getCurrentContext(sessionRunbook, guidedPlan) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook || !guidedPlan?.currentStep || !guidedPlan?.currentItem) return null;
  const currentStep = runbook.steps.find((step) => step.id === guidedPlan.currentStep.id) || guidedPlan.currentStep;
  const currentItem =
    currentStep.items.find((item) => item.id === guidedPlan.currentItem.id) || guidedPlan.currentItem;
  const nextItem = guidedPlan?.nextItem || null;
  return {
    runbook,
    currentStep,
    currentItem,
    nextItem,
    objective: runbook.objective || null,
  };
}

export const SESSION_TOOL_OUTPUT_KINDS = Object.freeze({
  SUPPORT_ARTIFACT: "support_artifact",
  UTILITY_ACTIVE: "utility_active",
});

export const SESSION_TOOL_EXECUTION_MODES = Object.freeze({
  LOCAL: "local",
  AI: "ai",
});

export const SESSION_TOOL_IDS = Object.freeze({
  CHECKLIST_TARGETED: "checklist_targeted",
  DRAFT_STARTER: "draft_starter",
  STRUCTURE_FIRST_PASS: "structure_first_pass",
  MICRO_SCRIPT: "micro_script",
  EXECUTION_CUES: "execution_cues",
  ITEM_TIMER: "item_timer",
  RECOVERY_BREATH: "recovery_breath",
});

const SESSION_TOOL_CATALOG = Object.freeze([
  Object.freeze({
    toolId: SESSION_TOOL_IDS.CHECKLIST_TARGETED,
    label: "Checklist ciblée",
    promise: "Découpe cette étape en actions cochables.",
    scope: "step",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.SUPPORT_ARTIFACT,
    executionMode: SESSION_TOOL_EXECUTION_MODES.AI,
    localFallback: true,
    protocolTypes: ["deep_work", "admin", "routine", "generic"],
    itemKinds: ["setup", "focus", "checkpoint", "process", "routine", "close", "task"],
  }),
  Object.freeze({
    toolId: SESSION_TOOL_IDS.DRAFT_STARTER,
    label: "Brouillon de départ",
    promise: "Prépare un texte de départ exploitable tout de suite.",
    scope: "step",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.SUPPORT_ARTIFACT,
    executionMode: SESSION_TOOL_EXECUTION_MODES.AI,
    localFallback: true,
    protocolTypes: ["admin", "generic", "deep_work"],
    itemKinds: ["focus", "checkpoint", "process", "close", "task"],
  }),
  Object.freeze({
    toolId: SESSION_TOOL_IDS.STRUCTURE_FIRST_PASS,
    label: "Structure 1er jet",
    promise: "Pose une trame rapide pour cette étape.",
    scope: "step",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.SUPPORT_ARTIFACT,
    executionMode: SESSION_TOOL_EXECUTION_MODES.AI,
    localFallback: true,
    protocolTypes: ["deep_work", "generic", "admin"],
    itemKinds: ["setup", "focus", "checkpoint", "task"],
  }),
  Object.freeze({
    toolId: SESSION_TOOL_IDS.MICRO_SCRIPT,
    label: "Micro-script",
    promise: "Rédige un message court ou une relance prête à adapter.",
    scope: "item",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.SUPPORT_ARTIFACT,
    executionMode: SESSION_TOOL_EXECUTION_MODES.AI,
    localFallback: true,
    protocolTypes: ["admin", "generic"],
    itemKinds: ["process", "close", "task"],
  }),
  Object.freeze({
    toolId: SESSION_TOOL_IDS.EXECUTION_CUES,
    label: "Repères d’exécution",
    promise: "Donne 3 repères concrets pour bien faire ce segment.",
    scope: "item",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.SUPPORT_ARTIFACT,
    executionMode: SESSION_TOOL_EXECUTION_MODES.AI,
    localFallback: true,
    protocolTypes: ["sport", "routine"],
    itemKinds: ["activation", "warmup", "effort", "cooldown", "breath", "routine"],
  }),
  Object.freeze({
    toolId: SESSION_TOOL_IDS.ITEM_TIMER,
    label: "Minuteur ciblé",
    promise: "Lance un minuteur sur l’item en cours.",
    scope: "item",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.UTILITY_ACTIVE,
    executionMode: SESSION_TOOL_EXECUTION_MODES.LOCAL,
    localFallback: true,
    protocolTypes: ["sport", "routine"],
    itemKinds: ["activation", "warmup", "effort", "cooldown", "breath", "routine"],
  }),
  Object.freeze({
    toolId: SESSION_TOOL_IDS.RECOVERY_BREATH,
    label: "Récupération guidée",
    promise: "Guide 60 à 90 sec de retour au calme.",
    scope: "item",
    outputKind: SESSION_TOOL_OUTPUT_KINDS.UTILITY_ACTIVE,
    executionMode: SESSION_TOOL_EXECUTION_MODES.LOCAL,
    localFallback: true,
    protocolTypes: ["sport", "routine"],
    itemKinds: ["cooldown", "breath", "routine"],
  }),
]);

const CATALOG_BY_ID = new Map(SESSION_TOOL_CATALOG.map((entry) => [entry.toolId, entry]));

function buildRecommendation(toolId, { stepId = null, itemId = null, rank = 100, reason = "" } = {}) {
  if (!CATALOG_BY_ID.has(toolId)) return null;
  return {
    toolId,
    stepId: asString(stepId) || null,
    itemId: asString(itemId) || null,
    rank: Number.isFinite(rank) ? Math.round(rank) : 100,
    reason: asString(reason),
  };
}

function recommendForStep(protocolType, step, item) {
  const context = readItemKinds(step, item);
  if (protocolType === "sport") {
    const recommendations = [
      buildRecommendation(SESSION_TOOL_IDS.ITEM_TIMER, {
        stepId: step.id,
        itemId: item.id,
        rank: 100,
        reason: "Cadre le segment en cours sans toucher au plan.",
      }),
    ];
    if (item.kind === "cooldown" || item.kind === "breath" || context.includes("retour au calme")) {
      recommendations.push(
        buildRecommendation(SESSION_TOOL_IDS.RECOVERY_BREATH, {
          stepId: step.id,
          itemId: item.id,
          rank: 94,
          reason: "Aide à faire redescendre le système proprement.",
        })
      );
    } else {
      recommendations.push(
        buildRecommendation(SESSION_TOOL_IDS.EXECUTION_CUES, {
          stepId: step.id,
          itemId: item.id,
          rank: 88,
          reason: "Donne des repères simples de rythme et de forme.",
        })
      );
    }
    return recommendations.filter(Boolean);
  }

  if (protocolType === "deep_work") {
    if (item.kind === "setup") {
      return [
        buildRecommendation(SESSION_TOOL_IDS.CHECKLIST_TARGETED, {
          stepId: step.id,
          itemId: item.id,
          rank: 98,
          reason: "Réduit la friction d’entrée sur l’étape.",
        }),
        buildRecommendation(SESSION_TOOL_IDS.STRUCTURE_FIRST_PASS, {
          stepId: step.id,
          itemId: item.id,
          rank: 86,
          reason: "Cadre vite la matière utile du bloc.",
        }),
      ].filter(Boolean);
    }
    return [
      buildRecommendation(SESSION_TOOL_IDS.STRUCTURE_FIRST_PASS, {
        stepId: step.id,
        itemId: item.id,
        rank: 98,
        reason: "Aide à organiser la sortie attendue du segment.",
      }),
      buildRecommendation(SESSION_TOOL_IDS.CHECKLIST_TARGETED, {
        stepId: step.id,
        itemId: item.id,
        rank: 88,
        reason: "Rend l’étape immédiatement exécutable.",
      }),
      buildRecommendation(SESSION_TOOL_IDS.DRAFT_STARTER, {
        stepId: step.id,
        itemId: item.id,
        rank: 74,
        reason: "Donne une première matière à retravailler.",
      }),
    ].filter(Boolean);
  }

  if (protocolType === "admin") {
    const looksLikeMessage =
      context.includes("message") ||
      context.includes("mail") ||
      context.includes("envoye") ||
      context.includes("relance") ||
      context.includes("demande");
    return [
      buildRecommendation(SESSION_TOOL_IDS.CHECKLIST_TARGETED, {
        stepId: step.id,
        itemId: item.id,
        rank: looksLikeMessage ? 78 : 98,
        reason: "Transforme le lot en actions fermables.",
      }),
      looksLikeMessage
        ? buildRecommendation(SESSION_TOOL_IDS.MICRO_SCRIPT, {
            stepId: step.id,
            itemId: item.id,
            rank: 100,
            reason: "Prépare une formulation courte et réutilisable.",
          })
        : buildRecommendation(SESSION_TOOL_IDS.DRAFT_STARTER, {
            stepId: step.id,
            itemId: item.id,
            rank: 86,
            reason: "Donne un brouillon réutilisable tout de suite.",
          }),
    ].filter(Boolean);
  }

  if (protocolType === "routine") {
    return [
      buildRecommendation(SESSION_TOOL_IDS.CHECKLIST_TARGETED, {
        stepId: step.id,
        itemId: item.id,
        rank: 96,
        reason: "Garde la routine simple et exécutable.",
      }),
      buildRecommendation(
        item.kind === "breath" || item.kind === "cooldown"
          ? SESSION_TOOL_IDS.RECOVERY_BREATH
          : SESSION_TOOL_IDS.EXECUTION_CUES,
        {
          stepId: step.id,
          itemId: item.id,
          rank: 84,
          reason: "Ajoute un support léger sans changer la séquence.",
        }
      ),
    ].filter(Boolean);
  }

  return [
    buildRecommendation(SESSION_TOOL_IDS.CHECKLIST_TARGETED, {
      stepId: step.id,
      itemId: item.id,
      rank: 96,
      reason: "Donne un support exécutable pour cette étape.",
    }),
    buildRecommendation(SESSION_TOOL_IDS.STRUCTURE_FIRST_PASS, {
      stepId: step.id,
      itemId: item.id,
      rank: 88,
      reason: "Pose une forme utile sans refaire le plan.",
    }),
    buildRecommendation(SESSION_TOOL_IDS.DRAFT_STARTER, {
      stepId: step.id,
      itemId: item.id,
      rank: 72,
      reason: "Prépare une sortie textuelle à retravailler.",
    }),
  ].filter(Boolean);
}

export function getSessionToolCatalog() {
  return SESSION_TOOL_CATALOG.map((entry) => ({ ...entry }));
}

export function buildSessionToolPlan({ sessionRunbook = null } = {}) {
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!runbook) return null;

  const protocolType = readProtocolType(runbook.protocolType);
  const recommendations = runbook.steps.flatMap((step) =>
    step.items.flatMap((item) => recommendForStep(protocolType, step, item))
  );

  if (!recommendations.length) return null;
  return {
    version: 1,
    source: "local_fallback",
    recommendations,
    catalog: getSessionToolCatalog(),
  };
}

export function normalizeSessionToolPlan(rawValue, { sessionRunbook = null } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : null;
  const runbook = normalizeSessionRunbook(sessionRunbook);
  if (!source || !runbook) return null;

  const stepIds = new Set(runbook.steps.map((step) => step.id));
  const itemIds = new Set(runbook.steps.flatMap((step) => step.items.map((item) => item.id)));
  const catalog = (Array.isArray(source.catalog) ? source.catalog : getSessionToolCatalog())
    .map((entry) => {
      const known = CATALOG_BY_ID.get(asString(entry?.toolId));
      return known ? { ...known } : null;
    })
    .filter(Boolean);
  const allowedToolIds = new Set(catalog.map((entry) => entry.toolId));
  const recommendations = (Array.isArray(source.recommendations) ? source.recommendations : [])
    .map((entry) =>
      buildRecommendation(asString(entry?.toolId), {
        stepId: asString(entry?.stepId) || null,
        itemId: asString(entry?.itemId) || null,
        rank: Number.isFinite(entry?.rank) ? entry.rank : 100,
        reason: asString(entry?.reason),
      })
    )
    .filter(Boolean)
    .filter((entry) => allowedToolIds.has(entry.toolId))
    .filter((entry) => (!entry.stepId || stepIds.has(entry.stepId)) && (!entry.itemId || itemIds.has(entry.itemId)));

  if (!recommendations.length) return null;
  return {
    version: 1,
    source: source.source === "ai_prepared" ? "ai_prepared" : "local_fallback",
    recommendations,
    catalog,
  };
}

export function deriveRecommendedSessionTools({
  sessionToolPlan = null,
  guidedPlan = null,
  maxTools = 3,
  accessToken = "",
} = {}) {
  const plan = isPlainObject(sessionToolPlan) ? sessionToolPlan : null;
  const currentStepId = asString(guidedPlan?.currentStep?.id) || null;
  const currentItemId = asString(guidedPlan?.currentItem?.id) || null;
  if (!plan || !currentStepId || !currentItemId) return [];

  const catalog = Array.isArray(plan.catalog) && plan.catalog.length ? plan.catalog : getSessionToolCatalog();
  const catalogById = new Map(catalog.map((entry) => [entry.toolId, entry]));
  const ranked = new Map();
  (Array.isArray(plan.recommendations) ? plan.recommendations : []).forEach((entry) => {
    const tool = catalogById.get(entry.toolId);
    if (!tool) return;
    const matchWeight =
      entry.itemId === currentItemId ? 300 : entry.stepId === currentStepId ? 200 : entry.itemId || entry.stepId ? 0 : 100;
    if (!matchWeight) return;
    if (!asString(accessToken) && tool.executionMode === "ai" && !tool.localFallback) return;
    const score = matchWeight + (Number.isFinite(entry.rank) ? entry.rank : 0);
    const existing = ranked.get(entry.toolId);
    if (!existing || score > existing.score) {
      ranked.set(entry.toolId, {
        ...tool,
        recommendationReason: entry.reason,
        rank: entry.rank,
        score,
      });
    }
  });

  return Array.from(ranked.values())
    .sort((left, right) => right.score - left.score)
    .slice(0, clamp(1, Math.round(maxTools || 3), 3));
}

function normalizeArtifact(rawValue, { fallbackTitle = "" } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : null;
  if (!source) return null;
  const title = asString(source.title) || fallbackTitle;
  const blocks = (Array.isArray(source.blocks) ? source.blocks : [])
    .map((block) => {
      if (!isPlainObject(block)) return null;
      const type = asString(block.type) || "paragraph";
      const titleText = asString(block.title);
      if (type === "list") {
        const items = (Array.isArray(block.items) ? block.items : []).map((item) => asString(item)).filter(Boolean);
        return items.length ? { type: "list", title: titleText, items } : null;
      }
      const text = asString(block.text);
      return text ? { type: "paragraph", title: titleText, text } : null;
    })
    .filter(Boolean);
  const copyText = asString(source.copyText);
  if (!title || !blocks.length || !copyText) return null;
  return {
    outputKind: SESSION_TOOL_OUTPUT_KINDS.SUPPORT_ARTIFACT,
    artifactType: asString(source.artifactType) || "artifact",
    title,
    blocks,
    copyText,
    createdAtMs: Number.isFinite(source.createdAtMs) ? source.createdAtMs : Date.now(),
  };
}

function normalizeUtility(rawValue, { utilityType = "" } = {}) {
  const source = isPlainObject(rawValue) ? rawValue : null;
  if (!source) return null;
  const durationSec = normalizePositiveSeconds(source.durationSec, 0);
  if (!durationSec) return null;
  return {
    outputKind: SESSION_TOOL_OUTPUT_KINDS.UTILITY_ACTIVE,
    utilityType: utilityType || asString(source.utilityType),
    title: asString(source.title) || "Utilitaire actif",
    subtitle: asString(source.subtitle),
    description: asString(source.description),
    state: ["idle", "running", "paused", "done"].includes(asString(source.state)) ? asString(source.state) : "idle",
    durationSec,
    remainingSec: normalizePositiveSeconds(source.remainingSec, durationSec) || durationSec,
    startedAtMs: Number.isFinite(source.startedAtMs) ? source.startedAtMs : null,
    collapsed: source.collapsed === true,
    config: isPlainObject(source.config) ? { ...source.config } : {},
    createdAtMs: Number.isFinite(source.createdAtMs) ? source.createdAtMs : Date.now(),
  };
}

function buildChecklistArtifact(context) {
  const checklistItems = [
    `Poser le cadre utile: ${context.currentStep.label}`,
    `Faire maintenant: ${context.currentItem.label}`,
    context.nextItem ? `Ensuite: ${context.nextItem.label}` : "",
    context.currentItem.successCue || context.currentStep.successCue || context.objective?.successDefinition || "",
  ].filter(Boolean);
  const copyText = buildCopyText(checklistItems.map((item) => `- [ ] ${item}`));
  return normalizeArtifact({
    artifactType: "checklist",
    title: `Checklist · ${context.currentStep.label}`,
    blocks: [
      {
        type: "list",
        title: "À faire maintenant",
        items: checklistItems,
      },
    ],
    copyText,
  });
}

function buildStructureArtifact(context) {
  const outline = [
    `${context.currentStep.label}`,
    `${context.currentItem.label}`,
    context.nextItem?.label || "Point de sortie",
  ].filter(Boolean);
  const copyText = buildCopyText(
    outline.map((item, index) => `${index + 1}. ${item}`).concat(
      context.objective?.why ? [`\nCap: ${context.objective.why}`] : []
    )
  );
  return normalizeArtifact({
    artifactType: "structure",
    title: `Structure · ${context.currentStep.label}`,
    blocks: [
      {
        type: "list",
        title: "Trame de départ",
        items: outline,
      },
      context.objective?.why
        ? {
            type: "paragraph",
            title: "Cap",
            text: context.objective.why,
          }
        : null,
    ].filter(Boolean),
    copyText,
  });
}

function buildDraftArtifact(context) {
  const paragraph = [
    `${titleCase(context.currentStep.label)} — ${context.currentItem.label}`,
    context.objective?.why ? `Objectif: ${context.objective.why}.` : "",
    context.currentItem.guidance ? `Point de départ: ${context.currentItem.guidance}.` : "",
    context.currentStep.successCue || context.objective?.successDefinition
      ? `Résultat visé: ${context.currentStep.successCue || context.objective?.successDefinition}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const copyText = buildCopyText([paragraph]);
  return normalizeArtifact({
    artifactType: "draft",
    title: `Brouillon · ${context.currentItem.label}`,
    blocks: [{ type: "paragraph", title: "Texte de départ", text: paragraph }],
    copyText,
  });
}

function buildScriptArtifact(context) {
  const script = [
    "Bonjour,",
    "",
    `Je reviens sur ${context.runbook.title.toLowerCase()}.`,
    context.currentItem.guidance ? `Point utile maintenant: ${context.currentItem.guidance}.` : "",
    context.objective?.successDefinition ? `Objectif: ${context.objective.successDefinition}.` : "",
    "",
    "Merci,",
  ].filter((line, index, list) => line || (index > 0 && list[index - 1]));
  return normalizeArtifact({
    artifactType: "script",
    title: `Micro-script · ${context.currentItem.label}`,
    blocks: [{ type: "paragraph", title: "Message prêt à adapter", text: script.join("\n") }],
    copyText: buildCopyText(script),
  });
}

function buildExecutionCuesArtifact(context) {
  const cues = [
    context.currentItem.guidance ? `Repère 1: ${context.currentItem.guidance}` : "",
    context.currentItem.successCue || context.currentStep.successCue
      ? `Repère 2: ${context.currentItem.successCue || context.currentStep.successCue}`
      : "",
    context.nextItem ? `Repère 3: enchaîne vers ${context.nextItem.label.toLowerCase()}` : "Repère 3: coupe avant de te crisper",
  ].filter(Boolean);
  return normalizeArtifact({
    artifactType: "cues_card",
    title: `Repères · ${context.currentItem.label}`,
    blocks: [{ type: "list", title: "Repères d’exécution", items: cues }],
    copyText: buildCopyText(cues.map((cue) => `- ${cue}`)),
  });
}

function buildItemTimerUtility(context) {
  const durationSec = Math.max(60, normalizePositiveSeconds(context.currentItem.minutes * 60, 60));
  return normalizeUtility({
    utilityType: "item_timer",
    title: `Minuteur · ${context.currentItem.label}`,
    subtitle: context.currentStep.label,
    description: context.currentItem.guidance,
    state: "idle",
    durationSec,
    remainingSec: durationSec,
    config: {
      restSec: normalizePositiveSeconds(context.currentItem.restSec, 0),
      stepLabel: context.currentStep.label,
      itemLabel: context.currentItem.label,
    },
  });
}

function buildRecoveryUtility(context) {
  const durationSec =
    context.runbook.protocolType === "sport"
      ? 90
      : 60;
  return normalizeUtility({
    utilityType: "recovery_breath",
    title: "Récupération guidée",
    subtitle: context.currentStep.label,
    description: "Reviens à un souffle calme avant de repartir ou de fermer.",
    state: "idle",
    durationSec,
    remainingSec: durationSec,
    config: {
      phases: [
        { label: "Inspire", seconds: 4 },
        { label: "Suspends", seconds: 2 },
        { label: "Expire", seconds: 6 },
      ],
    },
  });
}

export function executeLocalSessionTool({
  toolId = "",
  sessionRunbook = null,
  guidedPlan = null,
} = {}) {
  const context = getCurrentContext(sessionRunbook, guidedPlan);
  if (!context || !CATALOG_BY_ID.has(toolId)) return null;

  if (toolId === SESSION_TOOL_IDS.CHECKLIST_TARGETED) {
    return { kind: "artifact", artifact: buildChecklistArtifact(context) };
  }
  if (toolId === SESSION_TOOL_IDS.STRUCTURE_FIRST_PASS) {
    return { kind: "artifact", artifact: buildStructureArtifact(context) };
  }
  if (toolId === SESSION_TOOL_IDS.DRAFT_STARTER) {
    return { kind: "artifact", artifact: buildDraftArtifact(context) };
  }
  if (toolId === SESSION_TOOL_IDS.MICRO_SCRIPT) {
    return { kind: "artifact", artifact: buildScriptArtifact(context) };
  }
  if (toolId === SESSION_TOOL_IDS.EXECUTION_CUES) {
    return { kind: "artifact", artifact: buildExecutionCuesArtifact(context) };
  }
  if (toolId === SESSION_TOOL_IDS.ITEM_TIMER) {
    return { kind: "utility", utility: buildItemTimerUtility(context) };
  }
  if (toolId === SESSION_TOOL_IDS.RECOVERY_BREATH) {
    return { kind: "utility", utility: buildRecoveryUtility(context) };
  }
  return null;
}

export function normalizePreparedSessionToolPlan(rawValue, { sessionRunbook = null } = {}) {
  const normalized = normalizeSessionToolPlan(rawValue, { sessionRunbook });
  if (!normalized) return null;
  return {
    ...normalized,
    source: "ai_prepared",
  };
}

export function normalizePreparedSessionToolResult(rawValue, { toolId = "" } = {}) {
  const source =
    isPlainObject(rawValue?.sessionToolResult) ? rawValue.sessionToolResult
      : isPlainObject(rawValue?.toolResult) ? rawValue.toolResult
      : isPlainObject(rawValue) ? rawValue
      : null;
  if (!source || !CATALOG_BY_ID.has(toolId)) return null;
  const tool = CATALOG_BY_ID.get(toolId);
  if (tool.outputKind === SESSION_TOOL_OUTPUT_KINDS.UTILITY_ACTIVE) {
    const utility = normalizeUtility(source, { utilityType: tool.toolId });
    return utility ? { kind: "utility", utility } : null;
  }
  const artifact = normalizeArtifact(source, { fallbackTitle: tool.label });
  return artifact ? { kind: "artifact", artifact } : null;
}

export function normalizeSessionToolState(rawValue) {
  const source = isPlainObject(rawValue) ? rawValue : {};
  const artifactsByToolId = Object.fromEntries(
    Object.entries(isPlainObject(source.artifactsByToolId) ? source.artifactsByToolId : {})
      .map(([toolId, value]) => [toolId, normalizePreparedSessionToolResult(value, { toolId })?.artifact || null])
      .filter(([, value]) => value)
  );
  return {
    version: 1,
    lastToolId: asString(source.lastToolId) || null,
    openArtifactToolId: asString(source.openArtifactToolId) || null,
    artifactsByToolId,
    activeUtility: normalizeUtility(source.activeUtility, {
      utilityType: asString(source.activeUtility?.utilityType),
    }),
  };
}

export function createEmptySessionToolState() {
  return {
    version: 1,
    lastToolId: null,
    openArtifactToolId: null,
    artifactsByToolId: {},
    activeUtility: null,
  };
}

export function deriveActiveSessionToolUtilitySnapshot(activeUtility, nowMs = Date.now()) {
  const utility = normalizeUtility(activeUtility, { utilityType: asString(activeUtility?.utilityType) });
  if (!utility) return null;
  if (utility.state !== "running" || !Number.isFinite(utility.startedAtMs)) {
    return {
      ...utility,
      remainingLabel: formatSeconds(utility.remainingSec),
      progress01: utility.durationSec > 0 ? 1 - utility.remainingSec / utility.durationSec : 0,
      currentCue: utility.utilityType === "recovery_breath" ? "Prends un rythme calme." : "",
    };
  }

  const elapsed = Math.max(0, Math.floor((nowMs - utility.startedAtMs) / 1000));
  const remainingSec = Math.max(utility.remainingSec - elapsed, 0);
  const effectiveState = remainingSec === 0 ? "done" : "running";
  let currentCue = "";
  if (utility.utilityType === "recovery_breath") {
    const phases = Array.isArray(utility.config?.phases) ? utility.config.phases : [];
    const cycleLength = phases.reduce((sum, phase) => sum + normalizePositiveSeconds(phase?.seconds, 0), 0);
    if (cycleLength > 0) {
      const elapsedInCycle = elapsed % cycleLength;
      let threshold = 0;
      const currentPhase =
        phases.find((phase) => {
          threshold += normalizePositiveSeconds(phase?.seconds, 0);
          return elapsedInCycle < threshold;
        }) || phases[0];
      currentCue = asString(currentPhase?.label);
    }
  }

  return {
    ...utility,
    state: effectiveState,
    remainingSec,
    remainingLabel: formatSeconds(remainingSec),
    progress01: utility.durationSec > 0 ? 1 - remainingSec / utility.durationSec : 0,
    currentCue,
  };
}

export function startSessionToolUtility(activeUtility, nowMs = Date.now()) {
  const snapshot = deriveActiveSessionToolUtilitySnapshot(activeUtility, nowMs);
  if (!snapshot || snapshot.state === "running" || snapshot.state === "done") return snapshot;
  return {
    ...snapshot,
    state: "running",
    startedAtMs: nowMs,
  };
}

export function pauseSessionToolUtility(activeUtility, nowMs = Date.now()) {
  const snapshot = deriveActiveSessionToolUtilitySnapshot(activeUtility, nowMs);
  if (!snapshot || snapshot.state !== "running") return snapshot;
  return {
    ...snapshot,
    state: snapshot.remainingSec === 0 ? "done" : "paused",
    startedAtMs: null,
  };
}

export function resetSessionToolUtility(activeUtility) {
  const utility = normalizeUtility(activeUtility, { utilityType: asString(activeUtility?.utilityType) });
  if (!utility) return null;
  return {
    ...utility,
    state: "idle",
    startedAtMs: null,
    remainingSec: utility.durationSec,
    collapsed: false,
  };
}

export function toggleSessionToolUtilityCollapse(activeUtility) {
  const utility = normalizeUtility(activeUtility, { utilityType: asString(activeUtility?.utilityType) });
  if (!utility) return null;
  return {
    ...utility,
    collapsed: !utility.collapsed,
  };
}

