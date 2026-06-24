import { ADJUST_ACTION_IDS } from "./adjustDiagnostic";
import { buildAdjustSystemSignalPreview } from "./adjustSystemSignalPreviewModel";
import { getPrimarySystemSignal } from "../../logic/systemSignals";
import { RECOVERY_CONTEXT } from "../recovery/recoveryTypes";

const RECOVERY_COPY = Object.freeze({
  [RECOVERY_CONTEXT.LATE]: {
    title: "Bloc en retard",
    evidence: "1 bloc planifié est déjà en retard aujourd’hui.",
  },
  [RECOVERY_CONTEXT.BLOCKED]: {
    title: "Bloc bloqué",
    evidence: "1 bloc bloqué aujourd’hui.",
  },
  [RECOVERY_CONTEXT.MISSED]: {
    title: "Bloc manqué",
    evidence: "1 bloc manqué aujourd’hui.",
  },
  [RECOVERY_CONTEXT.REPORTED]: {
    title: "Bloc signalé",
    evidence: "1 bloc signalé aujourd’hui.",
  },
  [RECOVERY_CONTEXT.POSTPONED]: {
    title: "Bloc reporté",
    evidence: "1 bloc déjà reporté aujourd’hui.",
  },
});

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatMinutes(minutes) {
  const rounded = Math.round(safeNumber(minutes, 0));
  if (rounded <= 0) return "0 min";
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

function formatCount(count, singular, plural = `${singular}s`) {
  const value = Math.max(0, Math.round(safeNumber(count, 0)));
  return `${value} ${value > 1 ? plural : singular}`;
}

function resolveSummaryLabel(summary) {
  if (!summary?.hasPlannedData) return "Signal faible";
  if (summary.state === "friction") return "À ajuster";
  if (summary.state === "control") return "Sous contrôle";
  return "Système lisible";
}

function resolvePrimaryTone({ recoveryRequest, diagnostic, systemSignalPreview }) {
  if (recoveryRequest) return recoveryRequest.context === RECOVERY_CONTEXT.LATE ? "critical" : "attention";
  if (systemSignalPreview?.tone) return systemSignalPreview.tone;
  const tone = safeString(diagnostic?.recommendation?.tone);
  return tone || "execution";
}

function findRecommendationAction(diagnostic) {
  const actionId = safeString(diagnostic?.recommendation?.actionId);
  return safeArray(diagnostic?.quickActions).find((action) => action?.id === actionId) || null;
}

function buildRecoveryDiagnosis(recoveryRequest) {
  const copy = RECOVERY_COPY[recoveryRequest?.context] || {
    title: "Bloc à récupérer",
    evidence: "Un bloc concret peut être réparé maintenant.",
  };
  return {
    source: "recovery",
    primaryDiagnosis: {
      eyebrow: "CE QUI BLOQUE",
      title: copy.title,
      tone: recoveryRequest?.context === RECOVERY_CONTEXT.LATE ? "critical" : "attention",
    },
    evidence: copy.evidence,
    primaryAction: {
      kind: "recovery",
      label: "Réparer ce bloc",
      tone: "neutral",
      actionId: null,
    },
    note: "Tu choisis la réparation avant toute modification.",
  };
}

function buildGeneralDiagnosis({ diagnostic, systemSignalPreview }) {
  const recommendation = diagnostic?.recommendation || {};
  const recommendationAction = findRecommendationAction(diagnostic);
  const frictionSignals = safeArray(diagnostic?.frictionSignals);
  const summary = diagnostic?.summary || {};
  const hasStrongSignal = Boolean(systemSignalPreview?.title);
  const hasFriction = frictionSignals.length > 0;
  const calm = !hasStrongSignal && !hasFriction;
  const title =
    safeString(systemSignalPreview?.title) ||
    safeString(frictionSignals[0]?.title) ||
    (calm ? resolveSummaryLabel(summary) : safeString(recommendation.title)) ||
    "Système lisible";
  const evidence =
    safeString(systemSignalPreview?.message) ||
    safeString(frictionSignals[0]?.description) ||
    safeString(recommendation.description) ||
    "Aucun signal critique ne ressort maintenant.";

  return {
    source: hasStrongSignal ? "system_signal" : hasFriction ? "friction" : "recommendation",
    primaryDiagnosis: {
      eyebrow: calm ? "ÉTAT DU SYSTÈME" : "CE QUI BLOQUE",
      title,
      tone: calm ? "execution" : resolvePrimaryTone({ diagnostic, systemSignalPreview }),
    },
    evidence,
    primaryAction: {
      kind: "recommendation",
      label: safeString(recommendationAction?.label) || "Lancer cette correction",
      tone: recommendation?.actionId === ADJUST_ACTION_IDS.ASK_COACH ? "ai" : "neutral",
      actionId: recommendation?.actionId || ADJUST_ACTION_IDS.ASK_COACH,
    },
    note: "Aucune modification n’est appliquée sans ton choix.",
  };
}

function buildSecondaryContext(diagnostic) {
  const nextBlock = diagnostic?.nextBlock || null;
  if (nextBlock) {
    const parts = [
      safeString(nextBlock.categoryName),
      safeString(nextBlock.start),
      nextBlock.durationMinutes ? formatMinutes(nextBlock.durationMinutes) : "",
    ].filter(Boolean);
    return {
      type: "next_block",
      label: "PROCHAIN BLOC",
      title: safeString(nextBlock.title) || "Bloc d’exécution",
      description: parts.length ? parts.join(" - ") : "Prochain bloc utile identifié.",
      data: nextBlock,
    };
  }

  const summary = diagnostic?.summary || {};
  return {
    type: "system_state",
    label: "ÉTAT",
    title: resolveSummaryLabel(summary),
    description: [
      formatCount(summary.plannedCount, "bloc planifié", "blocs planifiés"),
      `${formatMinutes(summary.remainingMinutes)} à protéger`,
    ].join(" - "),
    data: summary,
  };
}

function buildMetricItems(summary) {
  return [
    { id: "planned", label: "Blocs planifiés", value: String(safeNumber(summary?.plannedCount, 0)) },
    { id: "done", label: "Terminés", value: String(safeNumber(summary?.doneCount, 0)) },
    {
      id: "missed_reported",
      label: "Manqués / reportés",
      value: String(safeNumber(summary?.missedCount, 0) + safeNumber(summary?.postponedCount, 0)),
    },
    { id: "remaining", label: "Charge restante", value: formatMinutes(summary?.remainingMinutes) },
  ];
}

function buildDetailSections({ diagnostic, primaryAction }) {
  const frictionSignals = safeArray(diagnostic?.frictionSignals);
  const quickActions = safeArray(diagnostic?.quickActions);
  const secondaryActions = quickActions.filter((action) => action?.id !== primaryAction?.actionId);
  const categorySignals = safeArray(diagnostic?.categorySignals);
  const trendSeries = safeArray(diagnostic?.trendSnapshot?.series);
  const expectedImpact = safeArray(diagnostic?.recommendation?.expectedImpact).filter(Boolean);

  return [
    {
      id: "signals",
      title: "Signaux détectés",
      summary: frictionSignals.length
        ? formatCount(frictionSignals.length, "signal", "signaux")
        : "Aucun signal fort",
      kind: "signals",
      items: frictionSignals,
    },
    {
      id: "trends",
      title: "Tendances et catégories",
      summary: trendSeries.length || categorySignals.length
        ? "Rythme récent disponible"
        : "Pas encore assez d’historique",
      kind: "trends",
      trendSnapshot: diagnostic?.trendSnapshot || null,
      categorySignals,
    },
    {
      id: "actions",
      title: "Autres leviers",
      summary: secondaryActions.length
        ? formatCount(secondaryActions.length, "option", "options")
        : "Coach déjà recommandé",
      kind: "actions",
      actions: secondaryActions,
      coach: {
        id: ADJUST_ACTION_IDS.ASK_COACH,
        label: "Ouvrir le Coach IA",
        description: "Demande un arbitrage sans modification automatique.",
      },
    },
    {
      id: "diagnostic",
      title: "Détails du diagnostic",
      summary: "Mesures et impact attendu",
      kind: "diagnostic",
      metrics: buildMetricItems(diagnostic?.summary || {}),
      expectedImpact,
    },
  ];
}

export function buildAdjustPresentationModel({
  diagnostic,
  recoveryRequest = null,
  systemAnalysisEntry = null,
} = {}) {
  const safeDiagnostic = diagnostic && typeof diagnostic === "object" ? diagnostic : {};
  const systemSignalPreview = buildAdjustSystemSignalPreview(
    getPrimarySystemSignal(safeArray(safeDiagnostic.systemSignals))
  );
  const primary = recoveryRequest
    ? buildRecoveryDiagnosis(recoveryRequest)
    : buildGeneralDiagnosis({ diagnostic: safeDiagnostic, systemSignalPreview });
  const secondaryContext = buildSecondaryContext(safeDiagnostic);
  const detailSections = buildDetailSections({
    diagnostic: safeDiagnostic,
    primaryAction: primary.primaryAction,
  });

  return {
    primaryDiagnosis: primary.primaryDiagnosis,
    evidence: primary.evidence,
    primaryAction: primary.primaryAction,
    secondaryContext,
    detailSections,
    recoveryRequest: recoveryRequest || null,
    systemAnalysisEntry: systemAnalysisEntry || { placement: "header", priority: "secondary" },
    note: primary.note,
    source: primary.source,
  };
}
